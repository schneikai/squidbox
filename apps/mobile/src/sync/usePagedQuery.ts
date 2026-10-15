import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { useCallback, useRef, useState } from 'react';

import type { AppDb } from './db/driver';
import { useLiveQuery } from './useLiveQuery';

export interface PagedQuery<R> {
  descriptor?: unknown; // what the query shows, as a plain object: a change starts at the first page
  read(db: AppDb, options: { limit: number }): Promise<{ rows: R[]; count: number }>;
  tables: SQLiteTable[];
}

export interface PagedResult<R> {
  rows: R[];
  count: number;
  limit: number; // the limit the rows were read at
  key?: string; // the descriptor they were read for (see usePagedQuery)
}

// Each page doubles the limit until the step reaches 3,000 rows (150, 300, …, 4,800, 7,800, 10,800,
// …), so reaching 50k rows reads ≈ 0.44 M rows in total instead of 8 M.
const MAX_STEP = 3000;

export function nextLimit(limit: number): number {
  return limit + Math.min(limit, MAX_STEP);
}

/**
 * Whether a bigger page would show more rows. Only the result read for this descriptor and limit can
 * tell: while a load-more or a new descriptor's first read is in flight, the previous result is still
 * shown, so repeated onEndReached or onScroll calls are no-ops until the new one lands.
 */
export function hasMore<R>(result: PagedResult<R> | undefined, key: string | undefined, limit: number): boolean {
  return !!result && result.key === key && result.limit === limit && result.count > limit;
}

/**
 * A live read of the first `limit` rows and the exact count of a query, where `loadMore` grows the
 * limit. The offset is always 0: the first page, a load-more and the refresh after a write are the
 * same read, so the database decides the order and nothing is appended. A new descriptor (a sort,
 * filter or search) starts again at `pageSize`, in the same render, so nothing is read at the old
 * depth; `keepLimit()` right before a descriptor change keeps the depth across it instead.
 */
export function usePagedQuery<R>(query: PagedQuery<R>, pageSize: number) {
  const key = JSON.stringify(query.descriptor);
  const [page, setPage] = useState({ key, limit: pageSize, keep: false });
  let limit = page.limit;
  if (page.key !== key) {
    limit = page.keep ? page.limit : pageSize;
    setPage({ key, limit, keep: false });
  }
  const result = useLiveQuery<PagedResult<R>>(
    async (db) => ({ ...(await query.read(db, { limit })), limit, key }),
    query.tables,
    [key, limit],
  );

  // Stable, so a scroll handler can hold it: it reads the latest state through the ref.
  const latest = useRef({ key, limit, canLoadMore: false });
  latest.current = { key, limit, canLoadMore: hasMore(result, key, limit) };
  const loadMore = useCallback(() => {
    const { key: current, limit: loaded, canLoadMore } = latest.current;
    if (canLoadMore) setPage({ key: current, limit: nextLimit(loaded), keep: false });
  }, []);
  const keepLimit = useCallback(() => setPage((current) => ({ ...current, keep: true })), []);

  return { rows: result?.rows, count: result?.count, loadMore, keepLimit };
}
