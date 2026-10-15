import * as FileSystem from 'expo-file-system/legacy';

import type { OpenLibrary } from './current';

import createAssetFileDirectory from '@/utils/assets/files/createAssetFileDirectory';
import createAssetThumbnailDirectory from '@/utils/assets/thumbnails/createAssetThumbnailDirectory';

// expo-sqlite keeps every database under this folder (it exists once a database has been opened).
const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;

// Every database file on this device, by name.
export async function listDatabaseNames(): Promise<string[]> {
  const info = await FileSystem.getInfoAsync(SQLITE_DIR);
  if (!info.exists) return [];
  return FileSystem.readDirectoryAsync(SQLITE_DIR);
}

// A library's two folders, ready before anything is written into them.
export async function createLibraryFolders(library: OpenLibrary): Promise<void> {
  await createAssetFileDirectory(library);
  await createAssetThumbnailDirectory(library);
}
