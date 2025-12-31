import * as FileSystem from 'expo-file-system';

import uploadFileAsync from './uploadFileAsync';

import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';

export default async function uploadAssetThumbnailAsync(asset) {
  const thumbnailUri = getAssetThumbnailUri(asset.thumbnailFilename);
  
  // Get file size for thumbnail - thumbnails are small so this is safe
  const fileInfo = await FileSystem.getInfoAsync(thumbnailUri);
  const fileSize = fileInfo.size;
  
  await uploadFileAsync(asset.thumbnailFilename, thumbnailUri, fileSize);
}
