import * as FileSystem from 'expo-file-system';

import assetSchema from './assetSchema';
import deleteAssetFilesAndThumbnailsAsync from './deleteAssetFilesAndThumbnailsAsync';
import createAssetFileDirectory from './files/createAssetFileDirectory';
import getAssetFileUri from './files/getAssetFileUri';
import getNewAssetId from './getNewAssetId';
import createAssetThumbnail from './thumbnails/createAssetThumbnail';

import getFileExtension from '@/utils/files/getFileExtension';

export default async function buildAssetAsync(assetData = {}) {
  const newAsset = { ...assetData };
  const sourceFileUri = extractSourceFileUri(newAsset);

  if (!sourceFileUri) {
    throw new Error('Build asset failed! Error: sourceFileUri is required');
  }

  if (!newAsset.id) newAsset.id = getNewAssetId();

  await createAssetFileDirectory();

  newAsset.filename = `${newAsset.id}.${getFileExtension(sourceFileUri)}`;
  const assetFileUri = getAssetFileUri(newAsset.filename);

  await FileSystem.moveAsync({
    from: sourceFileUri,
    to: assetFileUri,
  });

  try {
    newAsset.thumbnailFilename = await createAssetThumbnail(newAsset.id, assetFileUri, newAsset.mediaType);

    // Make sure the new asset is valid before returning it.
    assetSchema.validateSync(newAsset, { strict: true });
  } catch (e) {
    await deleteAssetFilesAndThumbnailsAsync(newAsset);
    throw e;
  }

  return newAsset;
}

function extractSourceFileUri(data) {
  const { sourceFileUri } = data;
  delete data.sourceFileUri;
  return sourceFileUri;
}
