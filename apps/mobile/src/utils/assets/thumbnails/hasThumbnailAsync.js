import * as FileSystem from 'expo-file-system/legacy';

import getAssetThumbnailUri from './getAssetThumbnailUri';

export default async function hasThumbnailAsync(thumbnailFilename, library) {
  // ignore assets without thumbnailFilename
  if (!thumbnailFilename) return true;

  const fileUri = getAssetThumbnailUri(thumbnailFilename, library);
  const fileInfo = await FileSystem.getInfoAsync(fileUri);

  return fileInfo.exists;
}
