import * as FileSystem from 'expo-file-system/legacy';

import getAssetThumbnailUri from './getAssetThumbnailUri';

import getFileExtension from '@/utils/files/getFileExtension';
import createThumbnail from '@/utils/thumbnails/createThumbnail';

// Create a thumbnail from the assets source file and save it to the device, into `library`'s
// thumbnails (the open library when none is given).
export default async function createAssetThumbnail(assetId, fileUri, mediaType, library) {
  const tempAssetThumbnailUri = await createThumbnail(fileUri, mediaType);
  const thumbnailFilename = `${assetId}thumb.${getFileExtension(tempAssetThumbnailUri)}`;

  try {
    await FileSystem.moveAsync({
      from: tempAssetThumbnailUri,
      to: getAssetThumbnailUri(thumbnailFilename, library),
    });
  } catch (e) {
    FileSystem.deleteAsync(tempAssetThumbnailUri, { idempotent: true });
    throw e;
  }

  return thumbnailFilename;
}
