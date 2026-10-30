import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  chunk,
  fieldClocksSchema,
  mergeRecord,
  type FieldClocks,
  type PushMutation,
  type PushResult,
} from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { driverError } from '../db/pgError.js';
import { serverCollections, type ServerCollection } from './collections.js';
import { sentFields } from './sentFields.js';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type ValidRecord = Record<string, unknown> & { id: string; updatedAt: number };

// SQLSTATE classes 22 (data exception) and 23 (integrity constraint violation) on a row the schema
// accepted: the row itself is at fault, so only that mutation is rejected. Anything else
// (connection, timeout) fails the whole push, which the client retries. So does a violated user_id
// foreign key: user_id comes from the token, so the user was deleted mid-push, not the row's fault.
function recordErrorCode(error: unknown): string | null {
  const { code, constraint } = driverError(error) ?? {};
  if (typeof code !== 'string' || !/^2[23]/.test(code)) return null;
  if (typeof constraint === 'string' && constraint.endsWith('_user_id_users_id_fk')) return null;
  return code;
}

/**
 * Push (sync-design §6). In ONE transaction, take a per-user advisory lock (serializes this
 * user's pushes so server_seq order == commit order → safe pull watermark; tenants don't
 * contend), read the stored records the batch names, then for each mutation:
 *   1. validate the record against the collection's Zod schema, and its `fields` (reject on failure);
 *   2. clamp a future `updatedAt` to server-now (clock skew, §7) and find the field clocks to merge
 *      (sentFields);
 *   3. merge it into the stored record (mergeRecord, §7; a push without fields gets no restored_deletions
 *      check) and write the row only when a field applied, so a replay gets no new server_seq; the
 *      rows are written in one upsert per collection, after the merges.
 * 'applied' when nothing sent was lost; otherwise 'skipped-lww' with the merged record as `current`
 * (required for client convergence, §6). user_id always comes from the token, never the client.
 * No hard deletes — a delete is an update setting deletedAt.
 *
 * The batch first runs in one savepoint. If a row raises a database error, that savepoint is
 * rolled back (the advisory lock, taken before it, stays held) and the batch reruns writing each row
 * in its own savepoint, so only that row is rejected (`db:<sqlstate>`) and only such pushes pay the
 * extra round trips per row.
 */
export async function push(db: Db, userId: string, mutations: PushMutation[]): Promise<PushResult[]> {
  const now = Date.now();

  return withUserLock(db, userId, async (tx) => {
    try {
      return await tx.transaction((batch) => applyMutations(batch, userId, mutations, now, false));
    } catch (error) {
      if (!recordErrorCode(error)) throw error;
      return applyMutations(tx, userId, mutations, now, true);
    }
  });
}

// Every write to a syncable table runs in a transaction holding this user's advisory lock (§3).
export function withUserLock<T>(db: Db, userId: string, write: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0::bigint))`);
    return write(tx);
  });
}

type Prepared = {
  col: ServerCollection;
  sentId: string;
  record: ValidRecord;
  fields: FieldClocks;
  wholeRecord: boolean;
};
type Stored = { record: ValidRecord; clocks: FieldClocks; restoredDeletions: number[] };

async function applyMutations(
  tx: Tx,
  userId: string,
  mutations: PushMutation[],
  now: number,
  isolateRows: boolean,
): Promise<PushResult[]> {
  const prepared = mutations.map((mutation) => prepare(mutation, now));
  const stored = await readStored(
    tx,
    userId,
    prepared.flatMap((entry) => ('col' in entry ? [entry] : [])),
  );
  // The rows to write in one upsert per collection, by id: a row merged twice is written once.
  const writes = new Map<ServerCollection, Map<string, Stored>>();
  const results: PushResult[] = [];
  for (const entry of prepared) {
    if (!('col' in entry)) {
      results.push(entry);
      continue;
    }
    const { col, sentId, record, fields, wholeRecord } = entry;
    const collection = col.descriptor.name;
    const key = `${collection}:${record.id}`;
    const before = stored.get(key);
    const merged = mergeRecord(col.descriptor, {
      stored: before?.record,
      storedClocks: before?.clocks ?? {},
      sent: record,
      sentClocks: fields,
      restoredDeletions: before?.restoredDeletions,
      wholeRecord,
    });
    if (merged.applied.length > 0) {
      const after: Stored = {
        record: merged.record as ValidRecord,
        clocks: merged.clocks,
        restoredDeletions: merged.restoredDeletions,
      };
      if (isolateRows) {
        try {
          await tx.transaction((row) => writeRows(row, col, userId, [after]));
        } catch (error) {
          const code = recordErrorCode(error);
          if (!code) throw error;
          results.push({ id: sentId, collection, status: 'rejected', reason: `db:${code}` });
          continue;
        }
      } else {
        let rows = writes.get(col);
        if (!rows) writes.set(col, (rows = new Map()));
        rows.set(record.id, after);
      }
      stored.set(key, after);
    }
    results.push(
      merged.lost.length > 0
        ? { id: sentId, collection, status: 'skipped-lww', current: merged.record }
        : { id: sentId, collection, status: 'applied' },
    );
  }
  for (const [col, rows] of writes) await writeRows(tx, col, userId, [...rows.values()]);
  return results;
}

// A mutation ready to merge, or the result that rejects it. The id is lowercased as Postgres stores a
// uuid, so the stored row is found whatever the case it was sent in; results name it as it was sent.
function prepare(mutation: PushMutation, now: number): Prepared | PushResult {
  const col = Object.hasOwn(serverCollections, mutation.collection)
    ? serverCollections[mutation.collection]
    : undefined;
  const sentId = String((mutation.record as { id?: unknown }).id ?? '');
  if (!col) return { id: sentId, collection: mutation.collection, status: 'rejected', reason: 'unknown-collection' };

  const collection = col.descriptor.name;
  const parsed = col.schema.safeParse(mutation.record);
  if (!parsed.success) {
    const reason = 'schema:' + parsed.error.issues.map((i) => i.path.join('.') || '(root)').join(',');
    return { id: sentId, collection, status: 'rejected', reason };
  }
  const clocks = mutation.fields === undefined ? undefined : fieldClocksSchema.safeParse(mutation.fields);
  if (clocks && !clocks.success) return { id: sentId, collection, status: 'rejected', reason: 'schema:fields' };

  const record = parsed.data as ValidRecord;
  return {
    col,
    sentId,
    record: { ...record, id: record.id.toLowerCase(), updatedAt: Math.min(record.updatedAt, now) }, // clamp future
    fields: sentFields(col, record, clocks?.data, now),
    wholeRecord: !clocks,
  };
}

// The stored records these mutations name, by `collection:id`, with their field clocks.
async function readStored(tx: Tx, userId: string, entries: Prepared[]): Promise<Map<string, Stored>> {
  const stored = new Map<string, Stored>();
  for (const col of new Set(entries.map((entry) => entry.col))) {
    const table = col.table as any;
    const ids = [...new Set(entries.filter((entry) => entry.col === col).map((entry) => entry.record.id))];
    const rows: Record<string, any>[] = [];
    for (const batch of chunk(ids, MAX_PARAMS - 1))
      rows.push(
        ...(await tx
          .select({
            ...col.wireColumns,
            fieldClock: table.fieldClock,
            ...(col.restoredDeletions && { restoredDeletions: col.restoredDeletions }),
          })
          .from(col.table)
          .where(and(eq(table.userId, userId), inArray(table.id, batch)))),
      );
    for (const { fieldClock, restoredDeletions, ...record } of rows)
      stored.set(`${col.descriptor.name}:${record.id}`, {
        record: record as ValidRecord,
        clocks: storedClocks(col, record.updatedAt, fieldClock),
        restoredDeletions: restoredDeletions ?? [],
      });
  }
  return stored;
}

// Every clocked field's clock, one missing at the row's updated_at. A row without clocks (written
// before per-field merge, or with every clock at its updated_at), or written since by a server without
// them (a rollback: its updated_at is newer than every clock), takes its updated_at for each (§7).
export function storedClocks(col: ServerCollection, updatedAt: number, fieldClock: FieldClocks | null): FieldClocks {
  const clocked = col.descriptor.clockedFields;
  const known = clocked.flatMap((field) => (fieldClock && field in fieldClock ? [fieldClock[field]!] : []));
  const legacy = known.length === 0 || updatedAt > Math.max(...known);
  return Object.fromEntries(clocked.map((field) => [field, legacy ? updatedAt : (fieldClock![field] ?? updatedAt)]));
}

// The field_clock column for a row's clocks: null when every clock is its updated_at, as storedClocks
// reads it back.
export function fieldClockColumn(col: ServerCollection, updatedAt: number, clocks: FieldClocks): FieldClocks | null {
  const clocked = col.descriptor.clockedFields;
  return clocked.every((field) => (clocks[field] ?? updatedAt) === updatedAt)
    ? null
    : Object.fromEntries(clocked.map((field) => [field, clocks[field] ?? updatedAt]));
}

// Upserts these rows (sync-design §6), as many per statement as Postgres' bind parameters allow. The
// guard keeps a purged row and a newer updated_at.
async function writeRows(tx: Tx, col: ServerCollection, userId: string, rows: Stored[]): Promise<void> {
  const table = col.table as any;
  for (const batch of chunk(rows, Math.floor(MAX_PARAMS / col.columnCount)))
    await tx
      .insert(col.table)
      .values(
        batch.map(({ record, clocks, restoredDeletions }) => ({
          ...record,
          userId,
          fieldClock: fieldClockColumn(col, record.updatedAt, clocks),
          ...(col.restoredDeletions && { restoredDeletions: restoredDeletions.length > 0 ? restoredDeletions : null }),
        })),
      )
      .onConflictDoUpdate({ target: [table.userId, table.id], set: col.upsertSet, setWhere: col.upsertGuard });
}

// Postgres takes at most 65,535 bind parameters per statement.
const MAX_PARAMS = 65_535;
