import webFileUrls from './webFileUrls';

// Web has no file system: no originals are kept, and a thumbnail or a file field's file is the
// presigned URL fetched for it (webFileUrls), which the browser caches. The rest is as on iOS (assetStorage.js); these
// replace its exists checks and thumbnail uri.
// With its extension, so Metro loads the iOS file here and not this one again.
export {
  getAssetFilesDirectory,
  getAssetThumbnailsDirectory,
  getDownloadsDirectory,
  getAssetFileUri,
  getFileFolderUri,
  createAssetDirectoriesAsync,
} from './assetStorage.js';

export function getAssetThumbnailUri(thumbnailFilename) {
  return webFileUrls.get(thumbnailFilename);
}

// A file field's file is its presigned URL too, under its own name.
export function getFieldFileUri(_folder, filename) {
  return webFileUrls.get(filename);
}

export function getAvatarUri(avatarFilename) {
  return webFileUrls.get(avatarFilename);
}

export async function hasAvatarAsync(avatarFilename) {
  return webFileUrls.has(avatarFilename);
}

// The web preview keeps no files.
export function deleteAvatar() {}

export async function assetFileExistsAsync() {
  return false;
}

export async function hasThumbnailAsync(thumbnailFilename) {
  if (!thumbnailFilename) return true;
  return webFileUrls.has(thumbnailFilename);
}
