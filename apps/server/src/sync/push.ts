import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { PushMutation, PushResult } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { serverCollections, toWireRecord } from './collections.js';

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
 */
export async function push(db: Db, userId: string, mutations: PushMutation[]): Promise<PushResult[]> {
  const now = Date.now();

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0::bigint))`);

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

      const record = parsed.data as Record<string, unknown> & { id: string; updatedAt: number };
      const updatedAt = record.updatedAt > now ? now : record.updatedAt; // clamp future
      const table = col.table as any;

      // Build the DO UPDATE SET from excluded.* for every updatable column.
      const set: Record<string, SQL> = {};
      for (const key of col.updateColumns) {
        set[key] = sql`excluded.${sql.identifier(table[key].name)}`;
      }

      const inserted = await tx
        .insert(col.table)
        .values({ ...record, updatedAt, userId })
        .onConflictDoUpdate({
          target: [table.userId, table.id],
          set,
          setWhere: sql`excluded.updated_at > ${table.updatedAt}`,
        })
        .returning();

      if (inserted.length > 0) {
        results.push({ id: record.id, collection: col.name, status: 'applied' });
      } else {
        // Lost LWW (or equal-timestamp replay): return the server's current winning record.
        const [current] = await tx
          .select()
          .from(col.table)
          .where(and(eq(table.userId, userId), eq(table.id, record.id)));
        results.push({
          id: record.id,
          collection: col.name,
          status: 'skipped-lww',
          current: current ? toWireRecord(current) : undefined,
        });
      }
    }
    return results;
  });
}
