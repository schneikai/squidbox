import { randomUUID } from 'node:crypto';
import type { AssetRecord } from '@squidbox/shared';

export function makeAssetRecord(over: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: randomUUID(),
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null,
    mediaLibraryAssetId: 'm1',
    mediaType: 'photo',
    width: 100,
    height: 100,
    fileSize: 500,
    duration: null,
    filename: 'a.jpg',
    thumbnailFilename: 't.jpg',
    isFavorite: false,
    notes: null,
    postHistory: [],
    lastPostedAt: null,
    oldFileId: null,
    isFileSynced: true,
    isThumbnailSynced: true,
    isSynced: true,
    ...over,
  };
}
