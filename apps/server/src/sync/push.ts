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
 *   3. merge it into the stored record (mergeRecord, §7) and write the row only when a field applied,
 *      so a replay gets no new server_seq.
 * 'applied' when nothing sent was lost; otherwise 'skipped-lww' with the merged record as `current`
 * (required for client convergence, §6). user_id always comes from the token, never the client.
 * No hard deletes — a delete is an update setting deletedAt.
 *
 * The batch first runs in one savepoint. If a row raises a database error, that savepoint is
 * rolled back (the advisory lock, taken before it, stays held) and the batch reruns with a
 * savepoint per row, so only that row is rejected (`db:<sqlstate>`) and only such pushes pay the
 * two extra round trips per row.
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

type Prepared = { col: ServerCollection; record: ValidRecord; fields: FieldClocks; wholeRecord: boolean };

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
  const results: PushResult[] = [];
  for (const entry of prepared) {
    if (!('col' in entry)) {
      results.push(entry);
      continue;
    }
    const { col, record, fields, wholeRecord } = entry;
    const key = `${col.name}:${record.id}`;
    const before = stored.get(key);
    const merged = mergeRecord(col.descriptor, {
      stored: before?.record,
      storedClocks: before?.clocks ?? {},
      sent: record,
      sentClocks: fields,
      wholeRecord,
    });
    if (merged.applied.length > 0) {
      const write = (t: Tx) => writeRow(t, col, userId, merged.record, merged.clocks);
      try {
        await (isolateRows ? tx.transaction(write) : write(tx));
      } catch (error) {
        const code = isolateRows && recordErrorCode(error);
        if (!code) throw error;
        results.push({ id: record.id, collection: col.name, status: 'rejected', reason: `db:${code}` });
        continue;
      }
      stored.set(key, { record: merged.record, clocks: merged.clocks });
    }
    results.push(
      merged.lost.length > 0
        ? { id: record.id, collection: col.name, status: 'skipped-lww', current: merged.record }
        : { id: record.id, collection: col.name, status: 'applied' },
    );
  }
  return results;
}

// A mutation ready to merge, or the result that rejects it.
function prepare(mutation: PushMutation, now: number): Prepared | PushResult {
  const col = serverCollections[mutation.collection];
  const rawId = String((mutation.record as { id?: unknown }).id ?? '');
  if (!col) return { id: rawId, collection: mutation.collection, status: 'rejected', reason: 'unknown-collection' };

  const parsed = col.schema.safeParse(mutation.record);
  if (!parsed.success) {
    const reason = 'schema:' + parsed.error.issues.map((i) => i.path.join('.') || '(root)').join(',');
    return { id: rawId, collection: col.name, status: 'rejected', reason };
  }
  const clocks = mutation.fields === undefined ? undefined : fieldClocksSchema.safeParse(mutation.fields);
  if (clocks && !clocks.success)
    return { id: rawId, collection: col.name, status: 'rejected', reason: 'schema:fields' };

  const record = parsed.data as ValidRecord;
  return {
    col,
    record: { ...record, updatedAt: Math.min(record.updatedAt, now) }, // clamp future
    fields: sentFields(col, record, clocks?.data, now),
    wholeRecord: !clocks,
  };
}

type Stored = { record: Record<string, unknown> & { updatedAt: number }; clocks: FieldClocks };

// The stored records these mutations name, by `collection:id`, with their field clocks.
async function readStored(tx: Tx, userId: string, entries: Prepared[]): Promise<Map<string, Stored>> {
  const stored = new Map<string, Stored>();
  for (const col of new Set(entries.map((entry) => entry.col))) {
    const table = col.table as any;
    const ids = [...new Set(entries.filter((entry) => entry.col === col).map((entry) => entry.record.id))];
    const rows = await tx
      .select({ ...col.wireColumns, fieldClock: table.fieldClock })
      .from(col.table)
      .where(and(eq(table.userId, userId), inArray(table.id, ids)));
    for (const { fieldClock, ...record } of rows as Record<string, any>[])
      stored.set(`${col.name}:${record.id}`, {
        record: record as Stored['record'],
        clocks: storedClocks(col, record.updatedAt, fieldClock),
      });
  }
  return stored;
}

// Every clocked field's clock, one missing at the row's updated_at. A row without clocks (written
// before per-field merge), or written since by a server without them (a rollback: its updated_at is
// newer than every clock), takes its updated_at for each (sync-design §7). Restore marks are kept.
function storedClocks(col: ServerCollection, updatedAt: number, fieldClock: FieldClocks | null): FieldClocks {
  const base = Object.fromEntries(col.clockedFields.map((field) => [field, updatedAt]));
  if (!fieldClock) return base;
  const known = col.clockedFields.flatMap((field) => (field in fieldClock ? [fieldClock[field]!] : []));
  if (known.length === 0 || updatedAt > Math.max(...known)) return { ...fieldClock, ...base };
  return { ...base, ...fieldClock };
}

function writeRow(
  tx: Tx,
  col: ServerCollection,
  userId: string,
  record: Record<string, unknown>,
  fieldClock: FieldClocks,
) {
  const table = col.table as any;
  const set = Object.fromEntries(
    Object.entries({ ...col.wireColumns, fieldClock: table.fieldClock })
      .filter(([key]) => key !== 'id')
      .map(([key, column]) => [key, sql`excluded.${sql.identifier((column as { name: string }).name)}`]),
  );
  return tx
    .insert(col.table)
    .values({ ...record, userId, fieldClock })
    .onConflictDoUpdate({ target: [table.userId, table.id], set });
}
