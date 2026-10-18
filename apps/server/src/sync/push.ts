import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { PushMutation, PushResult } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { assets } from '../db/schema.js';
import { serverCollections, toWireRecord, type ServerCollection } from './collections.js';
import { fieldMergeUpdate } from './fieldMergeUpdate.js';
import { storedClocks } from './storedClocks.js';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type ValidRecord = Record<string, unknown> & { id: string; updatedAt: number };
type Clocks = Record<string, number>;
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
 *   3. atomic upsert, INSERT … ON CONFLICT (user_id, id) DO UPDATE, composite conflict target:
 *      - with `fields`, a per-field merge of the fields it names (fieldMergeUpdate);
 *      - without (older apps, the legacy importer), whole-record LWW: WHERE excluded.updated_at >
 *        table.updated_at (strict >; for assets a purge is final, see appliesOver).
 * 'applied' when the push's changes hold; otherwise 'skipped-lww' with the server's current record
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
    const fields = mutation.fields && mapValues(mutation.fields, clamp);
    const write = (t: Tx) => (fields ? mergeUpsert(t, col, clamped, fields, userId) : upsert(t, col, clamped, userId));
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

// The newer version wins (strict >, §6). For assets, a purge also applies over a newer version that
// is still in the Deleted album (not over a restore), and nothing applies over a purged one (§7).
function appliesOver(col: ServerCollection): SQL {
  const newer = sql`excluded.updated_at > ${(col.table as any).updatedAt}`;
  if (col.table !== assets) return newer;
  const purgesTrashed = sql`excluded.purged_at is not null and ${assets.deletedAt} is not null`;
  return sql`${assets.purgedAt} is null and (${newer} or ${purgesTrashed})`;
}

async function upsert(tx: Tx, col: ServerCollection, record: ValidRecord, userId: string): Promise<PushResult> {
  const table = col.table as any;

  // DO UPDATE SET from excluded.* for the updatable columns the record carries: an optional
  // column an older client doesn't send keeps its stored value. Each field it carries takes the
  // record's clock; the others keep theirs.
  const set: Record<string, SQL> = {};
  for (const key of col.updateColumns) {
    if (key in record) set[key] = sql`excluded.${sql.identifier(table[key].name)}`;
  }
  const carried = col.mergeFields.filter((key) => key in record);
  const fieldClock = Object.fromEntries(carried.map((key) => [key, record.updatedAt]));
  set.fieldClock = sql`${storedClocks(col)} || excluded.field_clock`;

  const inserted = await tx
    .insert(col.table)
    .values({ ...record, userId, fieldClock })
    .onConflictDoUpdate({
      target: [table.userId, table.id],
      set,
      setWhere: appliesOver(col),
    })
    .returning();

  if (inserted.length > 0) return { id: record.id, collection: col.name, status: 'applied' };

  // Lost LWW (or equal-timestamp replay): return the server's current winning record.
  const current = await currentRow(tx, col, userId, record.id);
  return {
    id: record.id,
    collection: col.name,
    status: 'skipped-lww',
    current: current ? toWireRecord(current) : undefined,
  };
}

// A per-field push (§6): only the fields it names merge, each by its own clock. A sent field is lost
// when the row holds another clock or value for it after the merge; then the push is 'skipped-lww'
// and `current` (the merged row, with the fields that did apply) is what the device adopts. A replay
// changes nothing and is 'applied'.
async function mergeUpsert(
  tx: Tx,
  col: ServerCollection,
  record: ValidRecord,
  fields: Clocks,
  userId: string,
): Promise<PushResult> {
  const table = col.table as any;
  const sent = col.mergeFields.filter((field) => field in fields);
  const { set, setWhere } = fieldMergeUpdate(col, sent);
  const [updated] = await tx
    .insert(col.table)
    .values({ ...record, userId, fieldClock: fields })
    .onConflictDoUpdate({ target: [table.userId, table.id], set, setWhere })
    .returning();
  const row: Record<string, unknown> = updated ?? (await currentRow(tx, col, userId, record.id));
  const lost = sent.some((field) => storedClock(row, field) !== fields[field] || !Object.is(row[field], record[field]));
  if (!lost) return { id: record.id, collection: col.name, status: 'applied' };
  return { id: record.id, collection: col.name, status: 'skipped-lww', current: toWireRecord(row) };
}

function storedClock(row: Record<string, unknown>, field: string): number {
  const clocks = row.fieldClock as Clocks | null;
  return clocks ? (clocks[field] ?? 0) : (row.updatedAt as number);
}

async function currentRow(tx: Tx, col: ServerCollection, userId: string, id: string) {
  const table = col.table as any;
  const [row] = await tx
    .select()
    .from(col.table)
    .where(and(eq(table.userId, userId), eq(table.id, id)));
  return row;
}

function mapValues(clocks: Clocks, map: (clock: number) => number): Clocks {
  return Object.fromEntries(Object.entries(clocks).map(([field, clock]) => [field, map(clock)]));
}
