import * as FileSystem from 'expo-file-system';

import getAssetThumbnailUri from './getAssetThumbnailUri';

export default async function hasThumbnailAsync(thumbnailFilename) {
  // ignore assets without thumbnailFilename
  if (!thumbnailFilename) return true;

  const fileUri = getAssetThumbnailUri(thumbnailFilename);
  const fileInfo = await FileSystem.getInfoAsync(fileUri);

  return fileInfo.exists;
}
