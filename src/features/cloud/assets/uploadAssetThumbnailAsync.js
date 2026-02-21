import uploadFileAsync from './uploadFileAsync';

import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';

export default async function uploadAssetThumbnailAsync(asset) {
  const thumbnailUri = getAssetThumbnailUri(asset.thumbnailFilename);
  await uploadFileAsync(asset.thumbnailFilename, thumbnailUri);
}
