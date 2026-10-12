import webThumbnailUrls from './webThumbnailUrls';

export default async function hasThumbnailAsync(thumbnailFilename) {
  if (!thumbnailFilename) return true;
  return webThumbnailUrls.has(thumbnailFilename);
}
