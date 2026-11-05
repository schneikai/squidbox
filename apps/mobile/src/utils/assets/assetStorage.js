import { Directory, File, Paths } from 'expo-file-system';

import { FILE_FOLDERS } from '@/library/fileFields';
import deletePath from '@/utils/files/deletePath';

// Where a library keeps its assets on this device: originals and thumbnails in its documents
// folders, downloaded copies in the cache. `library` is always passed (useLibrary().paths, or the
// library a flow started with), so a late write lands in the library it belongs to. Web keeps no
// files: see assetStorage.web.js.

// Worked out on first use (web has no `Paths`): each read builds a native object, and thumbnails
// ask on every render.
let documentDir;
let cacheDir;
const documentFolder = () => (documentDir ??= folderUri(Paths.document));
const cacheFolder = () => (cacheDir ??= folderUri(Paths.cache));

/** @param {{ filesDir: string }} library */
export function getAssetFilesDirectory(library) {
  return `${documentFolder()}${library.filesDir}`;
}

/** @param {{ thumbnailsDir: string }} library */
export function getAssetThumbnailsDirectory(library) {
  return `${documentFolder()}${library.thumbnailsDir}`;
}

// The folder of a file field's files (library/fileFields.ts): `folder` is its LibraryPaths key.
export function getFileFolderUri(folder, library) {
  return `${documentFolder()}${library[folder]}`;
}

// The folder full-resolution files are fetched into (to save or share), each in a folder of its own,
// per library, so a removed library leaves none of its photos behind. In the cache: the OS may clear it.
/** @param {{ downloadsDir: string }} library */
export function getDownloadsDirectory(library) {
  return `${cacheFolder()}${library.downloadsDir}`;
}

export function getAssetFileUri(filename, library) {
  return `${getAssetFilesDirectory(library)}${filename}`;
}

export function getAssetThumbnailUri(thumbnailFilename, library) {
  return `${getAssetThumbnailsDirectory(library)}${thumbnailFilename}`;
}

export function getFieldFileUri(folder, filename, library) {
  return `${getFileFolderUri(folder, library)}${filename}`;
}

// A contact's photo (its file field `contacts.avatarFilename`).
export function getAvatarUri(avatarFilename, library) {
  return getFieldFileUri('avatarsDir', avatarFilename, library);
}

export async function hasAvatarAsync(avatarFilename, library) {
  return new File(getAvatarUri(avatarFilename, library)).exists;
}

// Removes a contact's old or removed photo from the device (the copy in the user's storage stays).
export function deleteAvatar(avatarFilename, library) {
  deletePath(getAvatarUri(avatarFilename, library));
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
  for (const uri of [
    getAssetFilesDirectory(library),
    getAssetThumbnailsDirectory(library),
    ...FILE_FOLDERS.map((folder) => getFileFolderUri(folder, library)),
  ]) {
    new Directory(uri).create({ intermediates: true, idempotent: true });
  }
}

// A folder's uri, ending in a slash, so names append to it.
function folderUri(directory) {
  return directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
}
