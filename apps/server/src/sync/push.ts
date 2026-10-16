import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { PushMutation, PushResult } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { serverCollections, toWireRecord, type ServerCollection } from './collections.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
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
 *   2. clamp a future `updatedAt` to server-now (clock skew, §7);
 *   3. atomic LWW upsert: INSERT … ON CONFLICT (user_id, id) DO UPDATE … WHERE
 *      excluded.updated_at > table.updated_at (strict >, composite conflict target).
 * A returned row = applied; no row on conflict = lost LWW → 'skipped-lww' with the server's
 * current winning record (required for client convergence, §6). user_id always comes from the
 * token, never the client. No hard deletes — a delete is an update setting deletedAt.
 *
 * The batch first runs in one savepoint. If a row raises a database error, that savepoint is
 * rolled back (the advisory lock, taken before it, stays held) and the batch reruns with a
 * savepoint per row, so only that row is rejected (`db:<sqlstate>`) and only such pushes pay the
 * two extra round trips per row.
 */
export async function push(db: Db, userId: string, mutations: PushMutation[]): Promise<PushResult[]> {
  const now = Date.now();

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0::bigint))`);

    try {
      return await tx.transaction((batch) => applyMutations(batch, userId, mutations, now, false));
    } catch (error) {
      if (!recordErrorCode(error)) throw error;
      return applyMutations(tx, userId, mutations, now, true);
    }
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
    const updatedAt = record.updatedAt > now ? now : record.updatedAt; // clamp future
    const clamped = { ...record, updatedAt };
    if (!isolateRows) {
      results.push(await upsert(tx, col, clamped, userId));
      continue;
    }
    try {
      results.push(await tx.transaction((savepoint) => upsert(savepoint, col, clamped, userId)));
    } catch (error) {
      const code = recordErrorCode(error);
      if (!code) throw error;
      results.push({ id: record.id, collection: col.name, status: 'rejected', reason: `db:${code}` });
    }
  }
  return results;
}

async function upsert(tx: Tx, col: ServerCollection, record: ValidRecord, userId: string): Promise<PushResult> {
  const table = col.table as any;

  // DO UPDATE SET from excluded.* for the updatable columns the record carries: an optional
  // column an older client doesn't send keeps its stored value.
  const set: Record<string, SQL> = {};
  for (const key of col.updateColumns) {
    if (key in record) set[key] = sql`excluded.${sql.identifier(table[key].name)}`;
  }

  const inserted = await tx
    .insert(col.table)
    .values({ ...record, userId })
    .onConflictDoUpdate({
      target: [table.userId, table.id],
      set,
      setWhere: sql`excluded.updated_at > ${table.updatedAt}`,
    })
    .returning();

  if (inserted.length > 0) return { id: record.id, collection: col.name, status: 'applied' };

  // Lost LWW (or equal-timestamp replay): return the server's current winning record.
  const [current] = await tx
    .select()
    .from(col.table)
    .where(and(eq(table.userId, userId), eq(table.id, record.id)));
  return {
    id: record.id,
    collection: col.name,
    status: 'skipped-lww',
    current: current ? toWireRecord(current) : undefined,
  };
}
