import deleteAssetFileAsync from './files/deleteAssetFileAsync';
import deleteAssetThumbnailAsync from './thumbnails/deleteAssetThumbnailAsync';

// Delete asset file and thumbnail from device.
// To delete cloud files, use src/features/cloud/assets/deleteAssetFilesAsync
export default async function deleteAssetFilesAndThumbnailsAsync(assetOrAssets) {
  const assets = Array.isArray(assetOrAssets) ? assetOrAssets : [assetOrAssets];

  for (const asset of assets) {
    if (asset.filename) await deleteAssetFileAsync(asset.filename);
    if (asset.thumbnailFilename) await deleteAssetThumbnailAsync(asset.thumbnailFilename);
  }
}
