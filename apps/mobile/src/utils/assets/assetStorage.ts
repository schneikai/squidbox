import { File } from 'expo-file-system';

import {
  getAssetFileUri,
  getAssetThumbnailsDirectory,
  getDownloadFolderUri,
  getFileFolderUri,
} from './assetDirectories';

import { type FileFolder, isFileName } from '@/library/fileFields';
import type { LibraryPaths } from '@/library/libraryPaths';
import { KEEP_DOWNLOADS_FOR } from '@/utils/assets/constants';
import deletePath from '@/utils/files/deletePath';

// An asset's files in a library on this device (the folders: assetDirectories). Web keeps no files:
// see assetStorage.web.ts.
export {
  getAssetFilesDirectory,
  getAssetThumbnailsDirectory,
  getDownloadsDirectory,
  getDownloadFolderUri,
  getAssetFileUri,
  getFileFolderUri,
  createAssetDirectoriesAsync,
} from './assetDirectories';

export function getAssetThumbnailUri(thumbnailFilename: string, library: Pick<LibraryPaths, 'thumbnailsDir'>): string {
  return `${getAssetThumbnailsDirectory(library)}${thumbnailFilename}`;
}

// A file field's file in its folder; throws for a value that isn't a plain file name (isFileName), so
// a synced value never reaches outside the folder.
export function getFieldFileUri(folder: FileFolder, filename: string, library: Pick<LibraryPaths, FileFolder>): string {
  if (!isFileName(filename)) throw new Error(`Not a file name: ${JSON.stringify(filename)}`);
  return `${getFileFolderUri(folder, library)}${filename}`;
}

// A contact's photo (its file field `contacts.avatarFilename`).
export function getAvatarUri(avatarFilename: string, library: Pick<LibraryPaths, 'avatarsDir'>): string {
  return getFieldFileUri('avatarsDir', avatarFilename, library);
}

export async function hasAvatarAsync(
  avatarFilename: string,
  library: Pick<LibraryPaths, 'avatarsDir'>,
): Promise<boolean> {
  return new File(getAvatarUri(avatarFilename, library)).exists;
}

// Removes a contact's old or removed photo from the device (the copy in the user's storage stays).
export function deleteAvatar(avatarFilename: string, library: Pick<LibraryPaths, 'avatarsDir'>): void {
  deletePath(getAvatarUri(avatarFilename, library));
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

// When a download folder was last used (written once the file is whole, and on each reuse), as ms
// since the epoch in a file of its own.
const LAST_USED = 'last-used';

// An asset's full-resolution file on this device: the original (kept until the backup uploaded it),
// or else a download of the cloud copy (withAssetFileAsync) that is whole and was used within
// KEEP_DOWNLOADS_FOR. Null when there is neither.
export async function findLocalAssetFileAsync(
  filename: string,
  library: Pick<LibraryPaths, 'filesDir' | 'downloadsDir'>,
): Promise<{ uri: string; isKeptDownload: boolean } | null> {
  if (await assetFileExistsAsync(filename, library)) {
    return { uri: getAssetFileUri(filename, library), isKeptDownload: false };
  }
  // A name that isn't a plain file name has no download folder (getDownloadFolderUri).
  if (!isFileName(filename)) return null;
  const folder = getDownloadFolderUri(filename, library);
  const file = new File(`${folder}${filename}`);
  return file.exists && isFreshDownload(folder) ? { uri: file.uri, isKeptDownload: true } : null;
}

// Whether the download folder at `uri` was used within KEEP_DOWNLOADS_FOR. One without a readable
// mark (cut off mid-download, or an older layout) is not.
export function isFreshDownload(uri: string): boolean {
  try {
    const mark = new File(`${uri.replace(/\/?$/, '/')}${LAST_USED}`);
    if (!mark.exists) return false;
    const lastUsed = Number(mark.textSync());
    return Number.isFinite(lastUsed) && Date.now() - lastUsed <= KEEP_DOWNLOADS_FOR;
  } catch {
    return false;
  }
}

// Marks an asset's download as used now, so the stale sweep keeps it another KEEP_DOWNLOADS_FOR.
// Best effort: without the mark it is only downloaded again.
export function markDownloadUsed(filename: string, library: Pick<LibraryPaths, 'downloadsDir'>): void {
  try {
    new File(`${getDownloadFolderUri(filename, library)}${LAST_USED}`).writeSync(String(Date.now()));
  } catch (error) {
    console.warn('Could not mark a download as used', error);
  }
}
