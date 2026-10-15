import * as FileSystem from 'expo-file-system/legacy';

import getAssetThumbnailUri from './getAssetThumbnailUri';

export default async function deleteAssetThumbnailAsync(thumbnailFilename, library) {
  const thumbnailUri = getAssetThumbnailUri(thumbnailFilename, library);
  await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
}
