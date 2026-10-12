import webThumbnailUrls from '@/utils/assets/thumbnails/webThumbnailUrls';
import getAssetFileDownloadUrlsAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlsAsync';

export default async function preloadAssetThumbnailsAsync(assets) {
  const missing = assets.map((asset) => asset.thumbnailFilename).filter((name) => !webThumbnailUrls.has(name));
  if (missing.length === 0) return;

  for (const [thumbnailFilename, url] of await getAssetFileDownloadUrlsAsync(missing)) {
    webThumbnailUrls.set(thumbnailFilename, url);
  }
}
