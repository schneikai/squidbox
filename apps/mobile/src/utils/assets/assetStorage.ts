import { File } from 'expo-file-system';

import { getAssetFileUri, getAssetThumbnailsDirectory, getFileFolderUri } from './assetDirectories';

import { type FileFolder, isFileName } from '@/library/fileFields';
import type { LibraryPaths } from '@/library/libraryPaths';
import deletePath from '@/utils/files/deletePath';

// An asset's files in a library on this device (the folders: assetDirectories). Web keeps no files:
// see assetStorage.web.ts.
export {
  getAssetFilesDirectory,
  getAssetThumbnailsDirectory,
  getDownloadsDirectory,
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
