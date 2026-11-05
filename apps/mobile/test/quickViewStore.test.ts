import { describe, it, expect, vi, beforeEach } from 'vitest';

import quickViewStore from '../src/components/quick-view/quickViewStore';

const asset = { id: 'a' };
const gridA = {};
const gridB = {};

describe('quickViewStore', () => {
  beforeEach(() => quickViewStore.close(quickViewStore.get()?.owner));

  it('closes a peek only for the grid that opened it', () => {
    quickViewStore.open(asset, { routeKey: null, owner: gridA });
    quickViewStore.close(gridB);
    expect(quickViewStore.get()).toEqual({ asset, routeKey: null, owner: gridA });
    quickViewStore.close(gridA);
    expect(quickViewStore.get()).toBeNull();
  });

  it('notifies no one on a close by a grid that did not open the peek', () => {
    const listener = vi.fn();
    const unsubscribe = quickViewStore.subscribe(listener);
    quickViewStore.close(gridA);
    quickViewStore.open(asset, { routeKey: null, owner: gridA });
    quickViewStore.close(gridB);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
