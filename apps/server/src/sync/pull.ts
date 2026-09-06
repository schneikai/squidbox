import { and, asc, eq, gt } from 'drizzle-orm';
import type { PullResponse } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { serverCollections, toWireRecord } from './collections.js';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

/**
 * Cursor-based pull (sync-design §5). For each collection, fetch up to `limit` rows with
 * server_seq > cursor ordered by server_seq; global-merge by server_seq, cut at `limit`, and
 * set the response cursor to the server_seq of the last INCLUDED row. The per-user advisory
 * lock on push (see push.ts) makes server_seq order == commit order within a user's partition,
 * so max(included seq) is a safe watermark (no commit-visibility gap). All queries are scoped
 * by user_id — a tenant never sees another tenant's rows.
 */
export async function pull(
  db: Db,
  userId: string,
  opts: { cursor?: number; limit?: number }
): Promise<PullResponse> {
  const cursor = opts.cursor ?? 0;
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const merged: Array<{ collection: string; serverSeq: number; record: Record<string, unknown> }> = [];
  let anyHitLimit = false;

  for (const col of Object.values(serverCollections)) {
    const table = col.table as any;
    const rows: Array<Record<string, unknown>> = await db
      .select()
      .from(col.table)
      .where(and(eq(table.userId, userId), gt(table.serverSeq, cursor)))
      .orderBy(asc(table.serverSeq))
      .limit(limit);
    if (rows.length === limit) anyHitLimit = true;
    for (const row of rows) {
      merged.push({ collection: col.name, serverSeq: row.serverSeq as number, record: toWireRecord(row) });
    }
  }

  merged.sort((a, b) => a.serverSeq - b.serverSeq);
  const included = merged.slice(0, limit);
  // More to fetch if we cut the merged list, or any single collection was capped at `limit`
  // (it may hold rows with higher seq we didn't fetch). The client loops until hasMore=false.
  const hasMore = merged.length > limit || anyHitLimit;
  const newCursor = included.length ? included[included.length - 1].serverSeq : cursor;

  const changes: PullResponse['changes'] = {};
  for (const col of Object.values(serverCollections)) changes[col.name] = { records: [] };
  for (const item of included) changes[item.collection].records.push(item.record);

  return { changes, cursor: newCursor, hasMore };
}
