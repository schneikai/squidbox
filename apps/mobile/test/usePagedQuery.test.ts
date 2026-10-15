import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

import { hasMore, nextLimit, usePagedQuery, type PagedQuery } from '../src/sync/usePagedQuery';

// The live hook needs the app database and React Navigation, which don't load in node; it is
// replaced by what it would return. A server render is enough to see what the hook passes and returns.
const liveQuery = vi.hoisted(() => vi.fn());
vi.mock('../src/sync/useLiveQuery', () => ({ useLiveQuery: liveQuery }));

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
    liveQuery.mockReturnValue({ rows: ['a'], count: 500, limit: 150 });
    const hook = renderHook(query, 150);
    expect(hook.rows).toEqual(['a']);
    expect(hook.count).toBe(500);

    const [read, tables, deps] = liveQuery.mock.calls[0]!;
    expect(tables).toBe(query.tables);
    expect(deps).toEqual(['{"scope":"all"}', 150]);
    expect(await read('db')).toEqual({ rows: ['a'], count: 500, limit: 150, key: '{"scope":"all"}' }); // echoes what it read
    expect(query.read).toHaveBeenCalledWith('db', { limit: 150 });
  });

  it('has nothing until the first read lands', () => {
    liveQuery.mockReturnValue(undefined);
    const hook = renderHook({ read: async () => ({ rows: [], count: 0 }), tables: [] }, 150);
    expect(hook.rows).toBeUndefined();
    expect(hook.count).toBeUndefined();
  });
});
