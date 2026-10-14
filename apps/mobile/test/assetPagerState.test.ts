import { describe, it, expect } from 'vitest';

import getCurrentAssetId from '../src/features/asset-detail/getCurrentAssetId';
import getVisibleAssetIds from '../src/features/asset-detail/getVisibleAssetIds';

const dropped = (...ids: string[]) => new Set(ids);

describe('asset pager state (getVisibleAssetIds + getCurrentAssetId)', () => {
  const assetIds = ['a', 'b', 'c', 'd'];

  it('keeps the selected asset current while it has not dropped out', () => {
    const droppedIds = dropped();
    expect(getVisibleAssetIds(assetIds, droppedIds)).toEqual(['a', 'b', 'c', 'd']);
    expect(getCurrentAssetId({ assetIds, droppedIds, selectedAssetId: 'c' })).toBe('c');
  });

  it('follows the selection to whichever asset was swiped to', () => {
    const droppedIds = dropped();
    expect(getCurrentAssetId({ assetIds, droppedIds, selectedAssetId: 'a' })).toBe('a');
    expect(getCurrentAssetId({ assetIds, droppedIds, selectedAssetId: 'd' })).toBe('d');
  });

  it('drops the assets the window found deleted or missing, and keeps ids outside the window', () => {
    expect(getVisibleAssetIds(assetIds, dropped('b', 'c'))).toEqual(['a', 'd']);
  });

  it('moves to the next asset when the current one dropped out', () => {
    expect(getCurrentAssetId({ assetIds, droppedIds: dropped('b', 'c'), selectedAssetId: 'b' })).toBe('d');
  });

  it('falls back to the previous asset when nothing follows', () => {
    expect(getCurrentAssetId({ assetIds, droppedIds: dropped('c', 'd'), selectedAssetId: 'c' })).toBe('b');
  });

  it('falls back to the first asset when the selection is unknown', () => {
    expect(getCurrentAssetId({ assetIds: ['a', 'b'], droppedIds: dropped(), selectedAssetId: 'zzz' })).toBe('a');
  });

  it('has no current asset when every asset is gone', () => {
    expect(getVisibleAssetIds(['a', 'b'], dropped('a', 'b'))).toEqual([]);
    expect(getCurrentAssetId({ assetIds: ['a', 'b'], droppedIds: dropped('a', 'b'), selectedAssetId: 'a' })).toBeNull();
  });
});
