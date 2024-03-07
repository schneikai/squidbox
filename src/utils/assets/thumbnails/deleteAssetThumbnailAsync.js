import * as FileSystem from 'expo-file-system';

import getAssetThumbnailUri from './getAssetThumbnailUri';

export default async function deleteAssetThumbnailAsync(thumbnailFilename) {
  const thumbnailUri = getAssetThumbnailUri(thumbnailFilename);
  await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
}
