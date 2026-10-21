import { openDatabaseAsync } from 'expo-sqlite';

import type { AssetFileNames } from './fs';
import { MIGRATED_LIBRARY_ID, libraryPaths } from './libraryPaths';

import { deleteAppDb } from '@/sync/db/client';
import webThumbnailUrls from '@/utils/assets/thumbnails/webThumbnailUrls';

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
  await deleteAppDb(dbName);
  return [];
}

// Web storage can't be listed (listDatabaseNames finds the pre-library name only), so a listed
// library's database is taken to exist: it was created when the library first opened.
export async function databaseExists(): Promise<boolean> {
  return true;
}

// wa-sqlite's OPFS pool has a fixed number of files (library-ownership plan §1.8); with all taken it
// reports SQLITE_CANTOPEN, which expo-sqlite passes on as a message only: `sqlite3_open_v2` when the
// database file itself gets none, "Error code 14" when a write's journal gets none.
const NO_SLOT = /sqlite3_open_v2|Error code 14:/;

// What to tell the user when a new library found no free file. Nothing in the app removes a parked
// library, so the way out is one the browser already holds, or clearing the site's data.
export function libraryLimitMessage(error: unknown): string | null {
  if (!(error instanceof Error && NO_SLOT.test(error.message))) return null;
  return "This browser can't hold more libraries. Sign in to an account used here before, or clear this site's data (unsynced changes are lost).";
}

// Web keeps no files: thumbnails are presigned URLs (utils/assets/thumbnails/webThumbnailUrls.js),
// and an asset's file exists only in the cloud.
export async function listFiles(): Promise<Set<string>> {
  return new Set();
}

export async function createLibraryFolders(): Promise<void> {}

export async function removeLibraryFolders(): Promise<void> {}

export async function removeAssetFiles(assets: AssetFileNames[]): Promise<void> {
  for (const { thumbnailFilename } of assets) if (thumbnailFilename) webThumbnailUrls.delete(thumbnailFilename);
}

export function purgedFilesRemover(): (assets: AssetFileNames[]) => Promise<void> {
  return removeAssetFiles;
}

export async function fileExists(): Promise<boolean> {
  return false;
}

export async function moveFile(): Promise<void> {}
