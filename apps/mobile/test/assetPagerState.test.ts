import { describe, it, expect } from 'vitest';

import getAssetPagerState from '../src/features/asset-detail/getAssetPagerState';

const live = (id: string) => ({ id, deletedAt: null });
const deleted = (id: string) => ({ id, deletedAt: 1 });
const byId = (...assets: { id: string }[]) => Object.fromEntries(assets.map((a) => [a.id, a]));

describe('getAssetPagerState', () => {
  const assetIds = ['a', 'b', 'c', 'd'];

  it('keeps the selected asset current while it is visible', () => {
    const assets = byId(live('a'), live('b'), live('c'), live('d'));
    expect(getAssetPagerState({ assetIds, assets, selectedAssetId: 'c' })).toEqual({
      visibleAssetIds: ['a', 'b', 'c', 'd'],
      currentAssetId: 'c',
    });
  });

  it('follows the selection to whichever asset was swiped to', () => {
    const assets = byId(live('a'), live('b'), live('c'), live('d'));
    expect(getAssetPagerState({ assetIds, assets, selectedAssetId: 'a' }).currentAssetId).toBe('a');
    expect(getAssetPagerState({ assetIds, assets, selectedAssetId: 'd' }).currentAssetId).toBe('d');
  });

  it('drops deleted and missing assets from the pager', () => {
    const assets = byId(live('a'), deleted('b'), live('d'));
    expect(getAssetPagerState({ assetIds, assets, selectedAssetId: 'a' }).visibleAssetIds).toEqual(['a', 'd']);
  });

  it('moves to the next visible asset when the current one is deleted', () => {
    const assets = byId(live('a'), deleted('b'), deleted('c'), live('d'));
    expect(getAssetPagerState({ assetIds, assets, selectedAssetId: 'b' }).currentAssetId).toBe('d');
  });

  it('falls back to the previous visible asset when nothing follows', () => {
    const assets = byId(live('a'), live('b'), deleted('c'), deleted('d'));
    expect(getAssetPagerState({ assetIds, assets, selectedAssetId: 'c' }).currentAssetId).toBe('b');
  });

  it('falls back to the first visible asset when the selection is unknown', () => {
    const assets = byId(live('a'), live('b'));
    expect(getAssetPagerState({ assetIds: ['a', 'b'], assets, selectedAssetId: 'zzz' }).currentAssetId).toBe('a');
  });

  it('has no current asset when every asset is gone', () => {
    const assets = byId(deleted('a'));
    expect(getAssetPagerState({ assetIds: ['a', 'b'], assets, selectedAssetId: 'a' })).toEqual({
      visibleAssetIds: [],
      currentAssetId: null,
    });
  });
});
