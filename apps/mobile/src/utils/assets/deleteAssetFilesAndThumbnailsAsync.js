import deleteAssetFileAsync from './files/deleteAssetFileAsync';
import deleteAssetThumbnailAsync from './thumbnails/deleteAssetThumbnailAsync';

// Delete asset file and thumbnail from device. (Cloud/S3 deletion is handled separately by the
// sync/asset flows, not here.)
export default async function deleteAssetFilesAndThumbnailsAsync(assetOrAssets) {
  const assets = Array.isArray(assetOrAssets) ? assetOrAssets : [assetOrAssets];

  for (const asset of assets) {
    if (asset.filename) await deleteAssetFileAsync(asset.filename);
    if (asset.thumbnailFilename) await deleteAssetThumbnailAsync(asset.thumbnailFilename);
  }
}
