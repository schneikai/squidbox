import * as FileSystem from 'expo-file-system/legacy';

// Where a library keeps its assets on this device: originals and thumbnails in its documents
// folders, downloaded copies in the cache. `library` is always passed (useLibrary().paths, or the
// library a flow started with), so a late write lands in the library it belongs to. Web keeps no
// files: see assetStorage.web.js.

/** @param {{ filesDir: string }} library */
export function getAssetFilesDirectory(library) {
  return `${FileSystem.documentDirectory}${library.filesDir}`;
}

/** @param {{ thumbnailsDir: string }} library */
export function getAssetThumbnailsDirectory(library) {
  return `${FileSystem.documentDirectory}${library.thumbnailsDir}`;
}

// The folder full-resolution files are fetched into (to save or share), each in a folder of its own,
// per library, so a removed library leaves none of its photos behind. In the cache: the OS may clear it.
/** @param {{ downloadsDir: string }} library */
export function getDownloadsDirectory(library) {
  return `${FileSystem.cacheDirectory}${library.downloadsDir}`;
}

export function getAssetFileUri(filename, library) {
  return `${getAssetFilesDirectory(library)}${filename}`;
}

export function getAssetThumbnailUri(thumbnailFilename, library) {
  return `${getAssetThumbnailsDirectory(library)}${thumbnailFilename}`;
}

export async function assetFileExistsAsync(filename, library) {
  return fileExistsAsync(getAssetFileUri(filename, library));
}

// An asset without a thumbnail name has none to look for.
export async function hasThumbnailAsync(thumbnailFilename, library) {
  if (!thumbnailFilename) return true;
  return fileExistsAsync(getAssetThumbnailUri(thumbnailFilename, library));
}

export async function createAssetDirectoriesAsync(library) {
  await FileSystem.makeDirectoryAsync(getAssetFilesDirectory(library), { intermediates: true });
  await FileSystem.makeDirectoryAsync(getAssetThumbnailsDirectory(library), { intermediates: true });
}

// Not library/fs's fileExists: that module builds on this one.
async function fileExistsAsync(uri) {
  return (await FileSystem.getInfoAsync(uri)).exists;
}
