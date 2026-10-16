import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { useCallback, useState } from 'react';

import type { SyncDb } from './db/types';
import { useLiveQueryState } from './useLiveQuery';

export interface PagedQuery<R> {
  descriptor?: unknown; // what the query shows, as a plain object: a change starts at the first page
  read(db: SyncDb, options: { limit: number }): Promise<{ rows: R[]; count: number }>;
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
 * shown.
 */
export function hasMore<R>(result: PagedResult<R> | undefined, key: string | undefined, limit: number): boolean {
  return !!result && result.key === key && result.limit === limit && result.count > limit;
}

export interface Page {
  key: string | undefined; // the descriptor, as JSON
  limit: number;
  keepFor: string | null; // the descriptor key that keeps this limit (keepLimit)
  wantsMore: boolean; // a load-more is waiting for the current result
}

/**
 * A new descriptor starts again at `pageSize` with no load-more waiting, unless it is the one
 * keepLimit named: that one keeps the limit and a waiting load-more (the grid stays where it is).
 */
export function pageForKey(page: Page, key: string | undefined, pageSize: number): Page {
  if (page.key === key) return page;
  const isKept = page.keepFor === key;
  return { key, limit: isKept ? page.limit : pageSize, keepFor: null, wantsMore: isKept && page.wantsMore };
}

/** A waiting load-more grows the limit once the current result shows more rows. */
export function pageAfterResult<R>(page: Page, result: PagedResult<R> | undefined): Page {
  if (!page.wantsMore || !hasMore(result, page.key, page.limit)) return page;
  return { ...page, limit: nextLimit(page.limit), wantsMore: false };
}

/**
 * A live read of the first `limit` rows and the exact count of a query, where `loadMore` grows the
 * limit. The offset is always 0: the first page, a load-more and the refresh after a write are the
 * same read, so the database decides the order and nothing is appended. A new descriptor (a sort,
 * filter or search) starts again at `pageSize`, in the same render, so nothing is read at the old
 * depth; `keepLimit(nextDescriptor)` right before switching to that descriptor keeps the depth.
 * `loadMore` is never lost: asked while a read is in flight or with nothing left, it waits and grows
 * the limit once the current result shows more rows (a new descriptor forgets it). With `withReadAt`,
 * `readAt` says how fresh the rows are, updated on every read (see useLiveQueryState); without it the
 * screen renders nothing for a re-read that returns the same rows.
 */
export function usePagedQuery<R>(query: PagedQuery<R>, pageSize: number, { withReadAt = false } = {}) {
  const key = JSON.stringify(query.descriptor);
  const [page, setPage] = useState<Page>({ key, limit: pageSize, keepFor: null, wantsMore: false });
  const current = pageForKey(page, key, pageSize);
  const { limit } = current;
  const { data: result, readAt } = useLiveQueryState<PagedResult<R>>(
    async (db) => ({ ...(await query.read(db, { limit })), limit, key }),
    query.tables,
    [key, limit],
    { everyRead: withReadAt },
  );
  const next = pageAfterResult(current, result);
  if (next !== page) setPage(next);

  const loadMore = useCallback(() => setPage((state) => (state.wantsMore ? state : { ...state, wantsMore: true })), []);
  const keepLimit = useCallback(
    (nextDescriptor: unknown) => setPage((state) => ({ ...state, keepFor: JSON.stringify(nextDescriptor) })),
    [],
  );

  return { rows: result?.rows, count: result?.count, readAt, loadMore, keepLimit };
}
