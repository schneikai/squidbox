import * as FileSystem from 'expo-file-system/legacy';

import type { OpenLibrary } from './current';
import type { LibraryPaths } from './libraryPaths';

import createAssetFileDirectory from '@/utils/assets/files/createAssetFileDirectory';
import getAssetFilesDirectory from '@/utils/assets/files/getAssetFilesDirectory';
import getDownloadsDirectory from '@/utils/assets/files/getDownloadsDirectory';
import createAssetThumbnailDirectory from '@/utils/assets/thumbnails/createAssetThumbnailDirectory';
import getAssetThumbnailsDirectory from '@/utils/assets/thumbnails/getAssetThumbnailsDirectory';

// expo-sqlite keeps every database under this folder (it exists once a database has been opened).
const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;

// Every database file on this device, by name.
export async function listDatabaseNames(): Promise<string[]> {
  return [...(await listFiles(SQLITE_DIR))];
}

// The names of the files in a folder (none for a folder that doesn't exist).
export async function listFiles(dir: string): Promise<Set<string>> {
  const info = await FileSystem.getInfoAsync(dir);
  return new Set(info.exists ? await FileSystem.readDirectoryAsync(dir) : []);
}

// A library's two folders, ready when it opens, before anything is written into them.
export async function createLibraryFolders(library: OpenLibrary): Promise<void> {
  await createAssetFileDirectory(library);
  await createAssetThumbnailDirectory(library);
}

// A removed library's folders and its downloads cache, with everything in them.
export async function removeLibraryFolders(paths: LibraryPaths): Promise<void> {
  for (const dir of [getAssetFilesDirectory(paths), getAssetThumbnailsDirectory(paths), getDownloadsDirectory(paths)]) {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  }
}

export async function fileExists(uri: string): Promise<boolean> {
  return (await FileSystem.getInfoAsync(uri)).exists;
}

// Moves a file into a destination that doesn't exist yet (the legacy iOS move would replace one).
export async function moveFile(from: string, to: string): Promise<void> {
  await FileSystem.moveAsync({ from, to });
}
