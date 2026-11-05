import type * as native from './assetStorage';
import webThumbnailUrls from './thumbnails/webThumbnailUrls';

// Web has no file system: no originals are kept, and a thumbnail is the presigned URL fetched for it
// (webThumbnailUrls), which the browser caches. The folders are as on iOS (assetDirectories); these
// replace its exists checks and thumbnail uri.
export {
  getAssetFilesDirectory,
  getAssetThumbnailsDirectory,
  getDownloadsDirectory,
  getAssetFileUri,
  createAssetDirectoriesAsync,
} from './assetDirectories';

// Undefined until the thumbnail's URL was fetched (preloadAssetThumbnailsAsync.web), where the
// native uri is always a path.
export function getAssetThumbnailUri(
  ...[thumbnailFilename]: Parameters<typeof native.getAssetThumbnailUri>
): string | undefined {
  return webThumbnailUrls.get(thumbnailFilename);
}

export async function assetFileExistsAsync(): ReturnType<typeof native.assetFileExistsAsync> {
  return false;
}

export async function hasThumbnailAsync(
  ...[thumbnailFilename]: Parameters<typeof native.hasThumbnailAsync>
): ReturnType<typeof native.hasThumbnailAsync> {
  if (!thumbnailFilename) return true;
  return webThumbnailUrls.has(thumbnailFilename);
}
