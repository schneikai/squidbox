import { assetCollection, type AssetRecord } from '@squidbox/shared';

import createAssetThumbnail from './thumbnails/createAssetThumbnail';

import { moveFile, removeAssetFiles } from '@/library/fs';
import type { LibraryPaths } from '@/library/libraryPaths';
import { getAssetFileUri } from '@/utils/assets/assetStorage';
import getFileExtension from '@/utils/files/getFileExtension';
import getNewItemId from '@/utils/getNewItemId';
import newRecord from '@/utils/newRecord';

// A new asset has no notes and isn't backed up yet.
const ASSET_DEFAULTS: Partial<AssetRecord> = {
  duration: null,
  isFavorite: false,
  notes: null,
  oldFileId: null,
  isFileSynced: false,
  isThumbnailSynced: false,
  isSynced: false,
  favoritedAt: null,
  takenAt: null,
  originalFilename: null,
  latitude: null,
  longitude: null,
  tags: null,
};

// What the picker knows of the file: the record's fields but those made here.
export type PickedAsset = Partial<Omit<AssetRecord, 'id' | 'filename' | 'thumbnailFilename'>> &
  Pick<AssetRecord, 'mediaType'> & { sourceFileUri: string };

// Moves a picked file into `library`'s folders, makes its thumbnail and resolves the new asset
// record (a caller adding several assets passes the same library, so they all land in it). An
// invalid record throws, and its files are removed again.
export default async function buildAssetAsync(
  { sourceFileUri, ...fields }: PickedAsset,
  library: LibraryPaths,
): Promise<AssetRecord> {
  if (!sourceFileUri) throw new Error('Build asset failed! Error: sourceFileUri is required');

  const id = getNewItemId();
  const filename = `${id}.${getFileExtension(sourceFileUri)}`;
  const assetFileUri = getAssetFileUri(filename, library);
  await moveFile(sourceFileUri, assetFileUri);

  let thumbnailFilename: string | undefined;
  try {
    thumbnailFilename = await createAssetThumbnail(id, assetFileUri, fields.mediaType, library);
    return newRecord(assetCollection, ASSET_DEFAULTS, { ...fields, id, filename, thumbnailFilename });
  } catch (e) {
    await removeAssetFiles([{ filename, thumbnailFilename }], library);
    throw e;
  }
}
