import { and, eq, inArray, sql } from 'drizzle-orm';
import { fieldClocksSchema, mergeRecord, type FieldClocks, type PushMutation, type PushResult } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { serverCollections, type ServerCollection } from './collections.js';
import { sentFields } from './sentFields.js';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type ValidRecord = Record<string, unknown> & { id: string; updatedAt: number };
type DriverError = { code?: unknown; constraint?: unknown; cause?: DriverError };

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

// The pg error, unwrapped from the `cause` that newer drizzle versions wrap it in (DrizzleQueryError).
function driverError(error: unknown): DriverError | undefined {
  const wrapped = error as DriverError | undefined;
  return wrapped?.code === undefined ? wrapped?.cause : wrapped;
}

/**
 * Push (sync-design §6). In ONE transaction, take a per-user advisory lock (serializes this
 * user's pushes so server_seq order == commit order → safe pull watermark; tenants don't
 * contend), read the stored records the batch names, then for each mutation:
 *   1. validate the record against the collection's Zod schema, and its `fields` (reject on failure);
 *   2. clamp a future `updatedAt` to server-now (clock skew, §7) and find the field clocks to merge
 *      (sentFields);
 *   3. merge it into the stored record (mergeRecord, §7; a push without fields gets no restored_through
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

type Prepared = { col: ServerCollection; sentId: string; record: ValidRecord; fields: FieldClocks; wholeRecord: boolean };
type Stored = { record: ValidRecord; clocks: FieldClocks; restoredThrough: number | null };

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
      restoredThrough: wholeRecord ? undefined : (before?.restoredThrough ?? null),
    });
    if (merged.applied.length > 0) {
      const after: Stored = {
        record: merged.record as ValidRecord,
        clocks: merged.clocks,
        restoredThrough: Math.max(before?.restoredThrough ?? 0, merged.restoredThrough ?? 0) || null,
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
      } else (writes.get(col) ?? writes.set(col, new Map()).get(col)!).set(record.id, after);
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
  const col = serverCollections[mutation.collection];
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
    const rows = await tx
      .select({
        ...col.wireColumns,
        fieldClock: table.fieldClock,
        ...(col.restoredThrough && { restoredThrough: col.restoredThrough }),
      })
      .from(col.table)
      .where(and(eq(table.userId, userId), inArray(table.id, ids)));
    for (const { fieldClock, restoredThrough, ...record } of rows as Record<string, any>[])
      stored.set(`${col.descriptor.name}:${record.id}`, {
        record: record as ValidRecord,
        clocks: storedClocks(col, record.updatedAt, fieldClock),
        restoredThrough: restoredThrough ?? null,
      });
  }
  return stored;
}

// Every clocked field's clock, one missing at the row's updated_at. A row without clocks (written
// before per-field merge, or with every clock at its updated_at), or written since by a server without
// them (a rollback: its updated_at is newer than every clock), takes its updated_at for each (§7).
function storedClocks(col: ServerCollection, updatedAt: number, fieldClock: FieldClocks | null): FieldClocks {
  const known = col.clockedFields.flatMap((field) => (fieldClock && field in fieldClock ? [fieldClock[field]!] : []));
  const legacy = known.length === 0 || updatedAt > Math.max(...known);
  return Object.fromEntries(
    col.clockedFields.map((field) => [field, legacy ? updatedAt : (fieldClock![field] ?? updatedAt)]),
  );
}

// One upsert of these rows (sync-design §6): field_clock null when every clock is the row's
// updated_at, as storedClocks reads it. The guard keeps a purged row and a newer updated_at.
function writeRows(tx: Tx, col: ServerCollection, userId: string, rows: Stored[]) {
  const table = col.table as any;
  return tx
    .insert(col.table)
    .values(
      rows.map(({ record, clocks, restoredThrough }) => ({
        ...record,
        userId,
        fieldClock: col.clockedFields.every((field) => (clocks[field] ?? record.updatedAt) === record.updatedAt)
          ? null
          : Object.fromEntries(col.clockedFields.map((field) => [field, clocks[field] ?? record.updatedAt])),
        ...(col.restoredThrough && { restoredThrough }),
      })),
    )
    .onConflictDoUpdate({ target: [table.userId, table.id], set: col.upsertSet, setWhere: col.upsertGuard });
}
