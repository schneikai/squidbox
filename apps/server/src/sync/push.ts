import { and, eq, sql } from 'drizzle-orm';
import { lostFields, type FieldClocks, type PushMutation, type PushResult } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { serverCollections, type ServerCollection } from './collections.js';
import { fieldMergeUpdate } from './fieldMergeUpdate.js';
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
 * contend), then for each mutation:
 *   1. validate the record against the collection's Zod schema (reject on failure);
 *   2. clamp a future `updatedAt` to server-now (clock skew, §7) and find the field clocks to merge
 *      (sentFields);
 *   3. atomic per-field merge of those, INSERT … ON CONFLICT (user_id, id) DO UPDATE (fieldMergeUpdate).
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
    const clamped = { ...record, updatedAt: Math.min(record.updatedAt, now) }; // clamp future
    const fields = sentFields(col, record, mutation.fields, now);
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

// The merged row is 'applied' when every sent field holds the pushed value. Otherwise the push lost
// a field, or the row is purged and the pushed record doesn't have the purge: then it is
// 'skipped-lww' with the whole merged record as `current`, for the device to adopt. A replay is
// 'applied'. Only the columns the check needs come back from the upsert.
async function upsert(
  tx: Tx,
  col: ServerCollection,
  record: ValidRecord,
  fields: FieldClocks,
  userId: string,
): Promise<PushResult> {
  const table = col.table as any;
  const sent = col.mergeFields.filter((field) => field in fields);
  const fieldClock = Object.fromEntries(col.clockedFields.filter((f) => f in fields).map((f) => [f, fields[f]]));
  const { set, setWhere } = fieldMergeUpdate(col, sent);
  const checked = [...new Set(['id', ...sent, ...(col.finalField ? [col.finalField] : [])])];
  const [updated] = await tx
    .insert(col.table)
    .values({ ...record, userId, fieldClock })
    .onConflictDoUpdate({ target: [table.userId, table.id], set, setWhere })
    .returning(Object.fromEntries(checked.map((field) => [field, col.wireColumns[field]!])) as any);
  const row: Record<string, unknown> = updated ?? (await currentRow(tx, col, userId, record.id));
  if (!isLost(col, sent, record, row)) return { id: record.id, collection: col.name, status: 'applied' };
  const current = updated ? await currentRow(tx, col, userId, record.id) : row;
  return { id: record.id, collection: col.name, status: 'skipped-lww', current };
}

function isLost(col: ServerCollection, sent: string[], record: ValidRecord, row: Record<string, unknown>): boolean {
  if (lostFields(sent, record, row).length > 0) return true;
  const final = col.finalField;
  return final !== undefined && row[final] != null && !Object.is(row[final], record[final] ?? null);
}

// The row's client-facing record.
async function currentRow(tx: Tx, col: ServerCollection, userId: string, id: string): Promise<Record<string, unknown>> {
  const table = col.table as any;
  const [row] = await tx
    .select(col.wireColumns)
    .from(col.table)
    .where(and(eq(table.userId, userId), eq(table.id, id)));
  return row!;
}
