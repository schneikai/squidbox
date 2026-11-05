import webThumbnailUrls from '@/utils/assets/thumbnails/webThumbnailUrls';
import getAssetFileDownloadUrlsAsync from '@/utils/cloud-api/assets/getAssetFileDownloadUrlsAsync';

// Like the native one, with presigned URLs in place of files (kept with the thumbnails' in
// webThumbnailUrls): resolves the names it has afterwards.
export default async function preloadAvatarsAsync(contacts, library, signal) {
  const names = contacts.map((contact) => contact.avatarFilename);
  const missing = names.filter((name) => !webThumbnailUrls.has(name));
  if (missing.length > 0) {
    const urls = await getAssetFileDownloadUrlsAsync(missing);
    if (signal?.aborted) return new Set();
    for (const [avatarFilename, url] of urls) webThumbnailUrls.set(avatarFilename, url);
  }
  return new Set(names.filter((name) => webThumbnailUrls.has(name)));
}
