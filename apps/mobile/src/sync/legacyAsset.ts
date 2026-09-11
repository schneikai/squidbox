import type { AssetRecord } from '@squidbox/shared';

// Adapter between the app's legacy asset shape (yup: isDeleted boolean, mediaType 'image',
// syncError as a synced-ish field) and the modern synced AssetRecord (deletedAt tombstone,
// mediaType 'photo'|'video'). Idempotent for already-modern input. Lets existing screens/creation
// keep producing legacy-shaped objects while the store + sync run on the modern shape; screens
// migrate to the modern shape incrementally.
type AnyAsset = Record<string, any>;

export function toAssetRecord(input: AnyAsset): AssetRecord {
  const now = Date.now();
  const deletedAt =
    input.deletedAt !== undefined ? input.deletedAt : input.isDeleted ? input.updatedAt ?? now : null;
  return {
    id: input.id,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deletedAt,
    mediaLibraryAssetId: input.mediaLibraryAssetId,
    mediaType: input.mediaType === 'image' ? 'photo' : input.mediaType,
    width: input.width,
    height: input.height,
    fileSize: input.fileSize,
    duration: input.duration ?? null,
    filename: input.filename,
    thumbnailFilename: input.thumbnailFilename,
    isFavorite: !!input.isFavorite,
    notes: input.notes ?? null,
    // postHistory / lastPostedAt are derived on-device (sync/derive.ts), not stored.
    oldFileId: input.oldFileId ?? null,
    isFileSynced: !!input.isFileSynced,
    isThumbnailSynced: !!input.isThumbnailSynced,
    isSynced: !!input.isSynced,
  };
}

/** Translate a partial legacy "changes" object into modern-field changes for updateAsset. */
export function toAssetChanges(changes: AnyAsset): Partial<AssetRecord> {
  const out: AnyAsset = { ...changes };
  if ('isDeleted' in out) {
    out.deletedAt = out.isDeleted ? Date.now() : null;
    delete out.isDeleted;
  }
  if (out.mediaType === 'image') out.mediaType = 'photo';
  delete out.syncError; // local-only; not a synced change here
  delete out.postHistory; // derived on-device — not a stored column anymore
  delete out.lastPostedAt;
  return out as Partial<AssetRecord>;
}
