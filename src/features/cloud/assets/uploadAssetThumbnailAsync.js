import uploadFileAsync from './uploadFileAsync';

import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';

export default async function uploadAssetThumbnailAsync(asset) {
  await uploadFileAsync(asset.thumbnailFilename, getAssetThumbnailUri(asset.thumbnailFilename));
}
