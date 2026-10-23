import webThumbnailUrls from './thumbnails/webThumbnailUrls';

// Web has no file system: no originals are kept, and a thumbnail is the presigned URL fetched for it
// (webThumbnailUrls), which the browser caches. The rest is as on iOS (assetStorage.js); these
// replace its exists checks and thumbnail uri.
// With its extension, so Metro loads the iOS file here and not this one again.
export {
  getAssetFilesDirectory,
  getAssetThumbnailsDirectory,
  getDownloadsDirectory,
  getAssetFileUri,
  createAssetDirectoriesAsync,
} from './assetStorage.js';

export function getAssetThumbnailUri(thumbnailFilename) {
  return webThumbnailUrls.get(thumbnailFilename);
}

export async function assetFileExistsAsync() {
  return false;
}

export async function hasThumbnailAsync(thumbnailFilename) {
  if (!thumbnailFilename) return true;
  return webThumbnailUrls.has(thumbnailFilename);
}
