import { describe, it, expect } from 'vitest';

import getCurrentAssetId from '../src/features/asset-detail/getCurrentAssetId';

const dropped = (...ids: string[]) => new Set(ids);

describe('asset pager state (getCurrentAssetId)', () => {
  const assetIds = ['a', 'b', 'c', 'd'];

  it('keeps the selected asset current while it has not dropped out', () => {
    expect(getCurrentAssetId({ assetIds, droppedIds: dropped('b', 'd'), selectedAssetId: 'c' })).toBe('c');
  });

  it('follows the selection to whichever asset was swiped to', () => {
    expect(getCurrentAssetId({ assetIds, droppedIds: dropped(), selectedAssetId: 'a' })).toBe('a');
    expect(getCurrentAssetId({ assetIds, droppedIds: dropped(), selectedAssetId: 'd' })).toBe('d');
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
    expect(getCurrentAssetId({ assetIds: ['a', 'b'], droppedIds: dropped('a', 'b'), selectedAssetId: 'a' })).toBeNull();
  });
});
