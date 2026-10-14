import { describe, it, expect } from 'vitest';

import { toAssetRecord, toAssetChanges } from '../src/sync/legacyAsset';
import { toModernRecord, toModernChanges } from '../src/sync/legacyBase';

// Membership (`assets`, `assetRefs`) lives in the edge collections, not in columns. The legacy
// adapters must strip it so a legacy-shaped write can't try to insert a dead column.
describe('legacy adapters strip dropped fields', () => {
  it('toModernRecord drops membership arrays, maps isDeleted→deletedAt', () => {
    const out = toModernRecord({ id: 'al1', name: 'A', assets: ['x'], isDeleted: true, updatedAt: 100 });
    expect(out).not.toHaveProperty('assets');
    expect(out.deletedAt).toBe(100);
    expect(out.name).toBe('A');
  });

  it('toModernChanges drops assetRefs', () => {
    const out = toModernChanges({ text: 'hi', assetRefs: [{ id: 'r', assetId: 'a' }] });
    expect(out).toEqual({ text: 'hi' });
  });

  it('toAssetRecord maps the legacy media type', () => {
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
    expect(out.mediaType).toBe('photo'); // image → photo
  });

  it('toAssetChanges strips the local-only syncError', () => {
    const out = toAssetChanges({ notes: 'n', syncError: 'e' });
    expect(out).toEqual({ notes: 'n' });
  });
});
