import { and, eq, sql } from 'drizzle-orm';
import type { FieldClocks, PushMutation, PushResult } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { serverCollections, toWireRecord, type ServerCollection } from './collections.js';
import { fieldMergeUpdate } from './fieldMergeUpdate.js';

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
 * contend), then for each mutation:
 *   1. validate the record against the collection's Zod schema, and its `fields` (reject on failure);
 *   2. clamp a future `updatedAt`, and future field clocks, to server-now (clock skew, §7);
 *   3. atomic per-field merge, INSERT … ON CONFLICT (user_id, id) DO UPDATE (fieldMergeUpdate), of
 *      the fields the mutation names; without `fields` (older apps, the legacy importer), of every
 *      field the record carries, at its updatedAt.
 * 'applied' when every sent field holds the sent value afterwards; otherwise 'skipped-lww' with the
 * merged record as `current` (required for client convergence, §6). user_id always comes from the
 * token, never the client. No hard deletes — a delete is an update setting deletedAt.
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

async function applyMutations(
  tx: Tx,
  userId: string,
  mutations: PushMutation[],
  now: number,
  isolateRows: boolean,
): Promise<PushResult[]> {
  const results: PushResult[] = [];
  for (const mutation of mutations) {
    const col = serverCollections[mutation.collection];
    const rawId = String((mutation.record as { id?: unknown }).id ?? '');

    if (!col) {
      results.push({ id: rawId, collection: mutation.collection, status: 'rejected', reason: 'unknown-collection' });
      continue;
    }

    const parsed = col.schema.safeParse(mutation.record);
    if (!parsed.success) {
      const reason = 'schema:' + parsed.error.issues.map((i) => i.path.join('.') || '(root)').join(',');
      results.push({ id: rawId, collection: col.name, status: 'rejected', reason });
      continue;
    }

    const record = parsed.data as ValidRecord;
    const invalidFields = Object.keys(mutation.fields ?? {}).filter(
      (field) => !col.mergeFields.includes(field) || !(field in record),
    );
    if (invalidFields.length > 0) {
      const reason = 'schema:' + invalidFields.map((field) => `fields.${field}`).join(',');
      results.push({ id: record.id, collection: col.name, status: 'rejected', reason });
      continue;
    }

    const clamp = (clock: number) => Math.min(clock, now); // clamp future
    const clamped = { ...record, updatedAt: clamp(record.updatedAt) };
    const sentFields =
      mutation.fields ??
      Object.fromEntries(col.mergeFields.filter((field) => field in record).map((field) => [field, record.updatedAt]));
    const fields = Object.fromEntries(Object.entries(sentFields).map(([field, clock]) => [field, clamp(clock)]));
    const write = (t: Tx) => upsert(t, col, clamped, fields, userId);
    if (!isolateRows) {
      results.push(await write(tx));
      continue;
    }
    try {
      results.push(await tx.transaction(write));
    } catch (error) {
      const code = recordErrorCode(error);
      if (!code) throw error;
      results.push({ id: record.id, collection: col.name, status: 'rejected', reason: `db:${code}` });
    }
  }
  return results;
}

// A sent field is lost when the row holds another value for it after the merge; then `current`, the
// merged row with the fields that did apply, is what the device adopts. A replay is 'applied'.
async function upsert(
  tx: Tx,
  col: ServerCollection,
  record: ValidRecord,
  fields: FieldClocks,
  userId: string,
): Promise<PushResult> {
  const table = col.table as any;
  const sent = col.mergeFields.filter((field) => field in fields);
  const fieldClock = Object.fromEntries(sent.filter((field) => field !== col.finalField).map((f) => [f, fields[f]]));
  const { set, setWhere } = fieldMergeUpdate(col, sent);
  const [updated] = await tx
    .insert(col.table)
    .values({ ...record, userId, fieldClock })
    .onConflictDoUpdate({ target: [table.userId, table.id], set, setWhere })
    .returning();
  const row: Record<string, unknown> = updated ?? (await currentRow(tx, col, userId, record.id));
  const result = (status: PushResult['status'], current?: Record<string, unknown>): PushResult => ({
    id: record.id,
    collection: col.name,
    status,
    ...(current && { current }),
  });
  const lost = sent.some((field) => !Object.is(row[field], record[field]));
  return lost ? result('skipped-lww', toWireRecord(row)) : result('applied');
}

async function currentRow(tx: Tx, col: ServerCollection, userId: string, id: string) {
  const table = col.table as any;
  const [row] = await tx
    .select()
    .from(col.table)
    .where(and(eq(table.userId, userId), eq(table.id, id)));
  return row;
}
