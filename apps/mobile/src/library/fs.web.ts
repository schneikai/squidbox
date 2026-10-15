import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';

import { MIGRATED_LIBRARY_ID, libraryPaths } from './libraryPaths';

// Web storage can't be listed, and opening a name creates its file, so a probe opens the one name
// a web install can have had before libraries existed and looks for the migrations table; a file
// the probe itself created is deleted again, since every existing file takes one of the few OPFS
// slots (see the library-ownership plan §1.8).
export async function listDatabaseNames(): Promise<string[]> {
  const { dbName } = libraryPaths(MIGRATED_LIBRARY_ID);
  const sqlite = await openDatabaseAsync(dbName);
  const migrated = await sqlite.getFirstAsync(
    "select name from sqlite_master where type = 'table' and name = '__drizzle_migrations'",
  );
  await sqlite.closeAsync();
  if (migrated) return [dbName];
  await deleteDatabaseAsync(dbName);
  return [];
}

// Web keeps no files: thumbnails are presigned URLs (utils/assets/thumbnails/webThumbnailUrls.js),
// and an asset's file exists only in the cloud.
export async function createLibraryFolders(): Promise<void> {}

export async function removeLibraryFolders(): Promise<void> {}

export async function fileExists(): Promise<boolean> {
  return false;
}

export async function moveFile(): Promise<void> {}
