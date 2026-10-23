import { assetCollection } from '@squidbox/shared';
import * as FileSystem from 'expo-file-system/legacy';

import createAssetThumbnail from './thumbnails/createAssetThumbnail';

import { removeAssetFiles } from '@/library/fs';
import { getAssetFileUri } from '@/utils/assets/assetStorage';
import getFileExtension from '@/utils/files/getFileExtension';
import getNewItemId from '@/utils/getNewItemId';
import newRecord from '@/utils/newRecord';

// A new asset has no notes and isn't backed up yet.
const ASSET_DEFAULTS = {
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
};

// Moves a picked file into `library`'s folders, makes its thumbnail and resolves the new asset
// record (a caller adding several assets passes the same library, so they all land in it). An
// invalid record throws, and its files are removed again.
export default async function buildAssetAsync({ sourceFileUri, ...fields }, library) {
  if (!sourceFileUri) throw new Error('Build asset failed! Error: sourceFileUri is required');

  const id = getNewItemId();
  const filename = `${id}.${getFileExtension(sourceFileUri)}`;
  const assetFileUri = getAssetFileUri(filename, library);
  await FileSystem.moveAsync({ from: sourceFileUri, to: assetFileUri });

  let thumbnailFilename;
  try {
    thumbnailFilename = await createAssetThumbnail(id, assetFileUri, fields.mediaType, library);
    return newRecord(assetCollection, ASSET_DEFAULTS, { ...fields, id, filename, thumbnailFilename });
  } catch (e) {
    await removeAssetFiles([{ filename, thumbnailFilename }], library);
    throw e;
  }
}
