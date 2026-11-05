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
export function getAssetThumbnailUri(thumbnailFilename: string): string | undefined {
  return webThumbnailUrls.get(thumbnailFilename);
}

export async function assetFileExistsAsync(): Promise<boolean> {
  return false;
}

export async function hasThumbnailAsync(thumbnailFilename: string | null | undefined): Promise<boolean> {
  if (!thumbnailFilename) return true;
  return webThumbnailUrls.has(thumbnailFilename);
}
