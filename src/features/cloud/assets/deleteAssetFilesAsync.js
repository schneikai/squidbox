import deleteAssetFilesAndThumbnailsAsync from '@/utils/assets/deleteAssetFilesAndThumbnailsAsync';
import apiDeleteAssetFileAsync from '@/utils/cloud-api/assets/deleteAssetFileAsync';

export default async function deleteAssetFilesAsync(assetOrAssets) {
  const assets = Array.isArray(assetOrAssets) ? assetOrAssets : [assetOrAssets];

  for (const asset of assets) {
    if (asset.isFileSynced) await apiDeleteAssetFileAsync(asset.filename);
    if (asset.isThumbnailSynced) await apiDeleteAssetFileAsync(asset.thumbnailFilename);
    await deleteAssetFilesAndThumbnailsAsync(asset);
  }
}
