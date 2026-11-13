import { getTableColumns, sql } from 'drizzle-orm';
import type { PullResponse } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { serverCollections } from './collections.js';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

type PulledRow = { collection: string; server_seq: string | number; record: Record<string, unknown> };

/**
 * Cursor-based pull (sync-design §5): every collection's rows with server_seq > cursor, read in one
 * statement, so on one snapshot, ordered by server_seq and cut at `limit`. The response cursor is
 * the server_seq of the last included row. The per-user advisory lock on push (see push.ts) makes
 * server_seq order == commit order within a user's partition, so on one snapshot max(included seq)
 * is a safe watermark. Read collection by collection, a push committed between two reads could
 * leave a lower seq unread behind a higher one. All queries are scoped by user_id: a tenant never
 * sees another tenant's rows.
 */
export async function pull(db: Db, userId: string, opts: { cursor?: number; limit?: number }): Promise<PullResponse> {
  const cursor = opts.cursor ?? 0;
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const reads = Object.values(serverCollections).map(({ table, descriptor, wireJson }) => {
    const { userId: userIdColumn, serverSeq } = getTableColumns(table);
    return sql`(select ${descriptor.name}::text as collection, ${serverSeq} as server_seq, ${wireJson} as record from ${table} where ${userIdColumn} = ${userId} and ${serverSeq} > ${cursor} order by ${serverSeq} limit ${limit + 1})`;
  });
  // One row past `limit` says whether there is more. Each collection reads at most that many along
  // its (user_id, server_seq) index, so a page never builds the record of every row past the cursor.
  const { rows } = await db.execute<PulledRow>(
    sql`${sql.join(reads, sql` union all `)} order by server_seq limit ${limit + 1}`,
  );

  const included = rows.slice(0, limit);
  const changes: PullResponse['changes'] = {};
  for (const col of Object.values(serverCollections)) changes[col.descriptor.name] = { records: [] };
  for (const row of included) changes[row.collection].records.push(row.record);
  const newCursor = included.length ? Number(included[included.length - 1].server_seq) : cursor;

  return { changes, cursor: newCursor, hasMore: rows.length > limit };
}
