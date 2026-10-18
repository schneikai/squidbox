import webThumbnailUrls from '@/utils/assets/thumbnails/webThumbnailUrls';
import getAssetFileDownloadUrlsAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlsAsync';

// Like the native one, with presigned URLs in place of files: resolves the names it has afterwards.
// Nothing is written once `signal` aborts (closing the library cleared webThumbnailUrls).
export default async function preloadAssetThumbnailsAsync(assets, library, signal) {
  const names = assets.map((asset) => asset.thumbnailFilename);
  const missing = names.filter((name) => !webThumbnailUrls.has(name));
  if (missing.length > 0) {
    const urls = await getAssetFileDownloadUrlsAsync(missing);
    if (signal?.aborted) return new Set();
    for (const [thumbnailFilename, url] of urls) webThumbnailUrls.set(thumbnailFilename, url);
  }
  return new Set(names.filter((name) => webThumbnailUrls.has(name)));
}
