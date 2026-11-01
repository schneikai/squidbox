import { Directory, File, Paths } from 'expo-file-system';

// Where a library keeps its assets on this device: originals and thumbnails in its documents
// folders, downloaded copies in the cache. `library` is always passed (useLibrary().paths, or the
// library a flow started with), so a late write lands in the library it belongs to. Web keeps no
// files: see assetStorage.web.js.

/** @param {{ filesDir: string }} library */
export function getAssetFilesDirectory(library) {
  return `${folderUri(Paths.document)}${library.filesDir}`;
}

/** @param {{ thumbnailsDir: string }} library */
export function getAssetThumbnailsDirectory(library) {
  return `${folderUri(Paths.document)}${library.thumbnailsDir}`;
}

// The folder full-resolution files are fetched into (to save or share), each in a folder of its own,
// per library, so a removed library leaves none of its photos behind. In the cache: the OS may clear it.
/** @param {{ downloadsDir: string }} library */
export function getDownloadsDirectory(library) {
  return `${folderUri(Paths.cache)}${library.downloadsDir}`;
}

export function getAssetFileUri(filename, library) {
  return `${getAssetFilesDirectory(library)}${filename}`;
}

export function getAssetThumbnailUri(thumbnailFilename, library) {
  return `${getAssetThumbnailsDirectory(library)}${thumbnailFilename}`;
}

export async function assetFileExistsAsync(filename, library) {
  return new File(getAssetFileUri(filename, library)).exists;
}

// An asset without a thumbnail name has none to look for.
export async function hasThumbnailAsync(thumbnailFilename, library) {
  if (!thumbnailFilename) return true;
  return new File(getAssetThumbnailUri(thumbnailFilename, library)).exists;
}

export async function createAssetDirectoriesAsync(library) {
  for (const uri of [getAssetFilesDirectory(library), getAssetThumbnailsDirectory(library)]) {
    new Directory(uri).create({ intermediates: true, idempotent: true });
  }
}

// A folder's uri, ending in a slash, so names append to it.
function folderUri(directory) {
  return directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
}
