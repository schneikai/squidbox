import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { useState } from 'react';

import type { AppDb } from './db/driver';
import { useLiveQuery } from './useLiveQuery';

export interface PagedQuery<R> {
  read(db: AppDb, options: { limit: number }): Promise<{ rows: R[]; count: number }>;
  tables: SQLiteTable[];
}

export interface PagedResult<R> {
  rows: R[];
  count: number;
  limit: number; // the limit the rows were read at
}

// Each page doubles the limit until the step reaches 3,000 rows (150, 300, …, 4,800, 7,800, 10,800,
// …), so reaching 50k rows reads ≈ 0.44 M rows in total instead of 8 M.
const MAX_STEP = 3000;

export function nextLimit(limit: number): number {
  return limit + Math.min(limit, MAX_STEP);
}

/**
 * Whether a bigger page would show more rows. While a load-more read is in flight the result's limit
 * lags the state's, so repeated onEndReached or onScroll calls are no-ops until it lands.
 */
export function hasMore<R>(result: PagedResult<R> | undefined, limit: number): boolean {
  return !!result && result.limit === limit && result.count > limit;
}

/**
 * A live read of the first `limit` rows and the exact count of a query, where `loadMore` grows the
 * limit and `reset` returns it to `pageSize`. The offset is always 0: the first page, a load-more and
 * the refresh after a write are the same read, so the database decides the order and nothing is
 * appended. The limit never resets by itself; the screen calls `reset` where it scrolls to the top.
 */
export function usePagedQuery<R>(query: PagedQuery<R>, deps: unknown[], pageSize: number) {
  const [limit, setLimit] = useState(pageSize);
  const result = useLiveQuery<PagedResult<R>>(
    async (db) => ({ ...(await query.read(db, { limit })), limit }),
    query.tables,
    [...deps, limit],
  );
  const canLoadMore = hasMore(result, limit);

  return {
    rows: result?.rows,
    count: result?.count,
    hasMore: canLoadMore,
    loadMore() {
      if (canLoadMore) setLimit(nextLimit(limit));
    },
    reset() {
      setLimit(pageSize);
    },
  };
}
