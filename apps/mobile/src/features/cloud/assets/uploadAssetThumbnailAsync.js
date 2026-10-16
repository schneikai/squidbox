import uploadFileAsync from './uploadFileAsync';

import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';

export default async function uploadAssetThumbnailAsync(asset, library, identity, options) {
  const thumbnailUri = getAssetThumbnailUri(asset.thumbnailFilename, library);
  await uploadFileAsync(asset.thumbnailFilename, thumbnailUri, identity, options);
}
