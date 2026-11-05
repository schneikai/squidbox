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
  getAvatarsDirectory,
  createAssetDirectoriesAsync,
} from './assetStorage.js';

export function getAssetThumbnailUri(thumbnailFilename) {
  return webThumbnailUrls.get(thumbnailFilename);
}

// A contact's photo is its presigned URL too, under its own name.
export function getAvatarUri(avatarFilename) {
  return webThumbnailUrls.get(avatarFilename);
}

export async function hasAvatarAsync(avatarFilename) {
  return webThumbnailUrls.has(avatarFilename);
}

// The web preview keeps no files.
export function deleteAvatar() {}

export async function assetFileExistsAsync() {
  return false;
}

export async function hasThumbnailAsync(thumbnailFilename) {
  if (!thumbnailFilename) return true;
  return webThumbnailUrls.has(thumbnailFilename);
}
