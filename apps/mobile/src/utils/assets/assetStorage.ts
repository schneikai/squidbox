import { File } from 'expo-file-system';

import { getAssetFileUri, getAssetThumbnailsDirectory } from './assetDirectories';

import type { LibraryPaths } from '@/library/libraryPaths';

// An asset's files in a library on this device (the folders: assetDirectories). Web keeps no files:
// see assetStorage.web.ts.
export {
  getAssetFilesDirectory,
  getAssetThumbnailsDirectory,
  getDownloadsDirectory,
  getAssetFileUri,
  createAssetDirectoriesAsync,
} from './assetDirectories';

export function getAssetThumbnailUri(thumbnailFilename: string, library: Pick<LibraryPaths, 'thumbnailsDir'>): string {
  return `${getAssetThumbnailsDirectory(library)}${thumbnailFilename}`;
}

export async function assetFileExistsAsync(
  filename: string,
  library: Pick<LibraryPaths, 'filesDir'>,
): Promise<boolean> {
  return new File(getAssetFileUri(filename, library)).exists;
}

// An asset without a thumbnail name has none to look for.
export async function hasThumbnailAsync(
  thumbnailFilename: string | null | undefined,
  library: Pick<LibraryPaths, 'thumbnailsDir'>,
): Promise<boolean> {
  if (!thumbnailFilename) return true;
  return new File(getAssetThumbnailUri(thumbnailFilename, library)).exists;
}
