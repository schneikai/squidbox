import { describe, it, expect } from 'vitest';

import getCurrentAssetId from '../src/features/asset-detail/getCurrentAssetId';
import getVisibleAssetIds from '../src/features/asset-detail/getVisibleAssetIds';

const live = (id: string) => ({ id, deletedAt: null });
const deleted = (id: string) => ({ id, deletedAt: 1 });
const byId = (...assets: { id: string }[]) => Object.fromEntries(assets.map((a) => [a.id, a]));

describe('asset pager state (getVisibleAssetIds + getCurrentAssetId)', () => {
  const assetIds = ['a', 'b', 'c', 'd'];

  it('keeps the selected asset current while it is visible', () => {
    const assets = byId(live('a'), live('b'), live('c'), live('d'));
    expect(getVisibleAssetIds(assetIds, assets)).toEqual(['a', 'b', 'c', 'd']);
    expect(getCurrentAssetId({ assetIds, assets, selectedAssetId: 'c' })).toBe('c');
  });

  it('follows the selection to whichever asset was swiped to', () => {
    const assets = byId(live('a'), live('b'), live('c'), live('d'));
    expect(getCurrentAssetId({ assetIds, assets, selectedAssetId: 'a' })).toBe('a');
    expect(getCurrentAssetId({ assetIds, assets, selectedAssetId: 'd' })).toBe('d');
  });

  it('drops deleted and missing assets from the pager', () => {
    const assets = byId(live('a'), deleted('b'), live('d'));
    expect(getVisibleAssetIds(assetIds, assets)).toEqual(['a', 'd']);
  });

  it('moves to the next visible asset when the current one is deleted', () => {
    const assets = byId(live('a'), deleted('b'), deleted('c'), live('d'));
    expect(getCurrentAssetId({ assetIds, assets, selectedAssetId: 'b' })).toBe('d');
  });

  it('falls back to the previous visible asset when nothing follows', () => {
    const assets = byId(live('a'), live('b'), deleted('c'), deleted('d'));
    expect(getCurrentAssetId({ assetIds, assets, selectedAssetId: 'c' })).toBe('b');
  });

  it('falls back to the first visible asset when the selection is unknown', () => {
    const assets = byId(live('a'), live('b'));
    expect(getCurrentAssetId({ assetIds: ['a', 'b'], assets, selectedAssetId: 'zzz' })).toBe('a');
  });

  it('has no current asset when every asset is gone', () => {
    const assets = byId(deleted('a'));
    expect(getVisibleAssetIds(['a', 'b'], assets)).toEqual([]);
    expect(getCurrentAssetId({ assetIds: ['a', 'b'], assets, selectedAssetId: 'a' })).toBeNull();
  });
});
