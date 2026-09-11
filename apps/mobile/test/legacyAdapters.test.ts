import { describe, it, expect } from 'vitest';
import { toModernRecord, toModernChanges } from '../src/sync/legacyBase';
import { toAssetRecord, toAssetChanges } from '../src/sync/legacyAsset';

// The edge/derive redesign removed `assets`, `assetRefs`, `postHistory`, `lastPostedAt` columns.
// The legacy adapters must strip them so a legacy-shaped write can't try to insert a dead column.
describe('legacy adapters strip dropped fields', () => {
  it('toModernRecord drops membership arrays + derived cache, maps isDeleted→deletedAt', () => {
    const out = toModernRecord({
      id: 'al1',
      name: 'A',
      assets: ['x'],
      postHistory: ['p'],
      lastPostedAt: 5,
      isDeleted: true,
      updatedAt: 100,
    });
    expect(out).not.toHaveProperty('assets');
    expect(out).not.toHaveProperty('postHistory');
    expect(out).not.toHaveProperty('lastPostedAt');
    expect(out.deletedAt).toBe(100);
    expect(out.name).toBe('A');
  });

  it('toModernChanges drops assetRefs/postHistory/lastPostedAt', () => {
    const out = toModernChanges({ text: 'hi', assetRefs: [{ id: 'r', assetId: 'a' }], postHistory: ['p'], lastPostedAt: 9 });
    expect(out).toEqual({ text: 'hi' });
  });

  it('toAssetRecord no longer emits postHistory/lastPostedAt', () => {
    const out = toAssetRecord({
      id: 'a1',
      mediaLibraryAssetId: 'm',
      mediaType: 'image',
      width: 1,
      height: 1,
      fileSize: 1,
      filename: 'f',
      thumbnailFilename: 't',
      isFileSynced: true,
      isThumbnailSynced: true,
      isSynced: true,
    });
    expect(out).not.toHaveProperty('postHistory');
    expect(out).not.toHaveProperty('lastPostedAt');
    expect(out.mediaType).toBe('photo'); // image → photo
  });

  it('toAssetChanges strips postHistory/lastPostedAt (and syncError)', () => {
    const out = toAssetChanges({ notes: 'n', postHistory: ['p'], lastPostedAt: 3, syncError: 'e' });
    expect(out).toEqual({ notes: 'n' });
  });
});
