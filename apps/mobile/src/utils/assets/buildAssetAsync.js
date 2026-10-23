import * as FileSystem from 'expo-file-system/legacy';

import assetSchema from './assetSchema';
import getAssetFileUri from './files/getAssetFileUri';
import createAssetThumbnail from './thumbnails/createAssetThumbnail';

import { removeAssetFiles } from '@/library/fs';
import getFileExtension from '@/utils/files/getFileExtension';
import getNewItemId from '@/utils/getNewItemId';

// `library`: the one whose folders the file and thumbnail go into (a caller adding several assets
// passes the same one, so they all land in the same library).
export default async function buildAssetAsync(assetData, library) {
  const newAsset = { ...assetData };
  const sourceFileUri = extractSourceFileUri(newAsset);

  if (!sourceFileUri) {
    throw new Error('Build asset failed! Error: sourceFileUri is required');
  }

  if (!newAsset.id) newAsset.id = getNewItemId();

  newAsset.filename = `${newAsset.id}.${getFileExtension(sourceFileUri)}`;
  const assetFileUri = getAssetFileUri(newAsset.filename, library);

  await FileSystem.moveAsync({
    from: sourceFileUri,
    to: assetFileUri,
  });

  try {
    newAsset.thumbnailFilename = await createAssetThumbnail(newAsset.id, assetFileUri, newAsset.mediaType, library);

    // Make sure the new asset is valid before returning it.
    assetSchema.validateSync(newAsset, { strict: true });
  } catch (e) {
    await removeAssetFiles([newAsset], library);
    throw e;
  }

  return newAsset;
}

function extractSourceFileUri(data) {
  const { sourceFileUri } = data;
  delete data.sourceFileUri;
  return sourceFileUri;
}
