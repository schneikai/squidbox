import { Directory, Paths } from 'expo-file-system';

import type { LibraryPaths } from '@/library/libraryPaths';

// Where a library keeps its assets on this device, on every platform: originals and thumbnails in its
// documents folders, downloaded copies in the cache (assetStorage re-exports these). `library` is
// always passed (useLibrary().paths, or the library a flow started with), so a late write lands in
// the library it belongs to.

// Worked out on first use (web has no `Paths`): each read builds a native object, and thumbnails
// ask on every render.
let documentDir: string | undefined;
let cacheDir: string | undefined;
const documentFolder = () => (documentDir ??= folderUri(Paths.document));
const cacheFolder = () => (cacheDir ??= folderUri(Paths.cache));

export function getAssetFilesDirectory(library: Pick<LibraryPaths, 'filesDir'>): string {
  return `${documentFolder()}${library.filesDir}`;
}

export function getAssetThumbnailsDirectory(library: Pick<LibraryPaths, 'thumbnailsDir'>): string {
  return `${documentFolder()}${library.thumbnailsDir}`;
}

// The folder full-resolution files are fetched into (to save or share), each in a folder of its own,
// per library, so a removed library leaves none of its photos behind. In the cache: the OS may clear it.
export function getDownloadsDirectory(library: Pick<LibraryPaths, 'downloadsDir'>): string {
  return `${cacheFolder()}${library.downloadsDir}`;
}

export function getAssetFileUri(filename: string, library: Pick<LibraryPaths, 'filesDir'>): string {
  return `${getAssetFilesDirectory(library)}${filename}`;
}

export async function createAssetDirectoriesAsync(library: LibraryPaths): Promise<void> {
  for (const uri of [getAssetFilesDirectory(library), getAssetThumbnailsDirectory(library)]) {
    new Directory(uri).create({ intermediates: true, idempotent: true });
  }
}

// A folder's uri, ending in a slash, so names append to it.
function folderUri(directory: Directory): string {
  return directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
}
