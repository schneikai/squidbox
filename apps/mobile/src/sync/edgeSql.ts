/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any edge table */
import { and, eq, isNull, notExists, sql, type SQL } from 'drizzle-orm';
import { alias, QueryBuilder, type SQLiteTable } from 'drizzle-orm/sqlite-core';

/**
 * `e` (an alias of `table`, the edge table a query drives from) is the canonical live edge of its
 * (parent, asset) pair: no other live edge of the pair sorts before it by `(position, id)`. A
 * concurrent add on two offline devices leaves two edges for one asset; rows, counts and ids all
 * keep the earliest one. The unary `+` on `x.position` is load-bearing: without it SQLite probes
 * the parent's position index with `position < ?` and every row scans all earlier edges (quadratic
 * in the album); with it the probe is `(asset_id = ?, parent = ?)` on the asset index. The plan
 * guard in test/performance.test.ts pins that line.
 */
export function isCanonicalEdge(table: SQLiteTable, e: any, parentField: 'albumId' | 'postId'): SQL {
  const x = alias(table, 'x') as any;
  const earlier = new QueryBuilder()
    .select({ one: sql`1` })
    .from(x)
    .where(
      and(
        eq(x[parentField], e[parentField]),
        eq(x.assetId, e.assetId),
        isNull(x.deletedAt),
        sql`(+${x.position}, ${x.id}) < (${e.position}, ${e.id})`,
      ),
    );
  return notExists(earlier);
}
