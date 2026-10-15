import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

import {
  hasMore,
  nextLimit,
  pageAfterResult,
  pageForKey,
  usePagedQuery,
  type Page,
  type PagedQuery,
} from '../src/sync/usePagedQuery';

// The live hook needs the app database and React Navigation, which don't load in node; it is
// replaced by what it would return. A server render is enough to see what the hook passes and returns.
const liveQuery = vi.hoisted(() => vi.fn());
vi.mock('../src/sync/useLiveQuery', () => ({ useLiveQueryState: liveQuery }));

function renderHook<R>(query: PagedQuery<R>, pageSize: number) {
  let hook: ReturnType<typeof usePagedQuery<R>> | undefined;
  function Probe() {
    hook = usePagedQuery(query, pageSize);
    return null;
  }
  renderToString(createElement(Probe));
  return hook!;
}

describe('usePagedQuery', () => {
  it('doubles the page until the step reaches 3,000 rows', () => {
    const limits = [150];
    while (limits.length < 9) limits.push(nextLimit(limits[limits.length - 1]!));
    expect(limits).toEqual([150, 300, 600, 1200, 2400, 4800, 7800, 10800, 13800]);
  });

  it('has more only once the result read for the current descriptor and limit shows a bigger count', () => {
    const result = { rows: [], count: 500, limit: 150, key: 'a' };
    expect(hasMore(undefined, 'a', 150)).toBe(false);
    expect(hasMore(result, 'a', 150)).toBe(true);
    expect(hasMore({ ...result, count: 150 }, 'a', 150)).toBe(false);
    expect(hasMore(result, 'a', 300)).toBe(false); // the load-more read is in flight
    expect(hasMore(result, 'b', 150)).toBe(false); // a new descriptor's first read is in flight
  });

  it('reads the first page with the count through the live query, keyed on the descriptor and the limit', async () => {
    const query = { descriptor: { scope: 'all' }, read: vi.fn(async () => ({ rows: ['a'], count: 500 })), tables: [] };
    liveQuery.mockReturnValue({ data: { rows: ['a'], count: 500, limit: 150, key: '{"scope":"all"}' }, readAt: 7 });
    const hook = renderHook(query, 150);
    expect(hook.rows).toEqual(['a']);
    expect(hook.count).toBe(500);
    expect(hook.readAt).toBe(7);

    const [read, tables, deps] = liveQuery.mock.calls[0]!;
    expect(tables).toBe(query.tables);
    expect(deps).toEqual(['{"scope":"all"}', 150]);
    expect(await read('db')).toEqual({ rows: ['a'], count: 500, limit: 150, key: '{"scope":"all"}' }); // echoes what it read
    expect(query.read).toHaveBeenCalledWith('db', { limit: 150 });
  });

  it('has nothing until the first read lands', () => {
    liveQuery.mockReturnValue({ data: undefined, readAt: -1 });
    const hook = renderHook({ read: async () => ({ rows: [], count: 0 }), tables: [] }, 150);
    expect(hook.rows).toBeUndefined();
    expect(hook.count).toBeUndefined();
  });

  const page = (over: Partial<Page> = {}): Page => ({ key: 'a', limit: 300, keepFor: null, wantsMore: false, ...over });
  const result = (over = {}) => ({ rows: [], count: 1000, limit: 300, key: 'a', ...over });

  it('starts a new descriptor at the page size, unless keepLimit named that descriptor', () => {
    expect(pageForKey(page(), 'a', 150)).toEqual(page());
    expect(pageForKey(page(), 'b', 150)).toEqual(page({ key: 'b', limit: 150 }));
    expect(pageForKey(page({ keepFor: 'b' }), 'b', 150)).toEqual(page({ key: 'b', limit: 300 }));
    expect(pageForKey(page({ keepFor: 'b', wantsMore: true }), 'b', 150)).toEqual(page({ key: 'b', wantsMore: true }));
    expect(pageForKey(page({ wantsMore: true }), 'b', 150)).toEqual(page({ key: 'b', limit: 150 }));
    // A keep meant for another descriptor (a failed reorder never switched) doesn't apply.
    expect(pageForKey(page({ keepFor: 'c' }), 'b', 150)).toEqual(page({ key: 'b', limit: 150 }));
  });

  it('keeps a load-more waiting until the current result shows more rows, then grows the limit once', () => {
    const waiting = page({ wantsMore: true });
    expect(pageAfterResult(waiting, undefined)).toBe(waiting); // nothing read yet
    expect(pageAfterResult(waiting, result({ limit: 150 }))).toBe(waiting); // the load-more read is in flight
    expect(pageAfterResult(waiting, result({ key: 'z' }))).toBe(waiting); // a new descriptor's read is in flight
    expect(pageAfterResult(waiting, result({ count: 300 }))).toBe(waiting); // all loaded: waits for more rows
    expect(pageAfterResult(waiting, result({ count: 310 }))).toEqual(page({ limit: 600 })); // the album grew
    expect(pageAfterResult(page(), result())).toEqual(page()); // nobody asked
  });
});
