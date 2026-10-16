import * as FileSystem from 'expo-file-system/legacy';

import type { OpenLibrary } from './current';
import type { LibraryPaths } from './libraryPaths';

import { chunk } from '@/sync/chunk';
import createAssetFileDirectory from '@/utils/assets/files/createAssetFileDirectory';
import getAssetFileUri from '@/utils/assets/files/getAssetFileUri';
import getAssetFilesDirectory from '@/utils/assets/files/getAssetFilesDirectory';
import getDownloadsDirectory from '@/utils/assets/files/getDownloadsDirectory';
import createAssetThumbnailDirectory from '@/utils/assets/thumbnails/createAssetThumbnailDirectory';
import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';
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

// The names of an asset's files; a missing one is left alone.
export type AssetFileNames = { filename?: string; thumbnailFilename?: string };

const LIST_FROM = 100; // assets; from here, listing the folders beats a delete per absent file
const PARALLEL = 50; // deletes at a time

// These files on this device: file and downloaded copy by `filename`, thumbnail by its name. Deleting
// an absent file succeeds, so a few are deleted blind; for many (a first sync's purges) the folders
// are listed once. A purge passes only the names no other asset uses (`unsharedFiles`).
export async function removeAssetFiles(assets: AssetFileNames[], library: LibraryPaths): Promise<void> {
  const copies = assets.flatMap(({ filename, thumbnailFilename }) => [
    ...(filename ? [getAssetFileUri(filename, library), `${getDownloadsDirectory(library)}${filename}`] : []),
    ...(thumbnailFilename ? [getAssetThumbnailUri(thumbnailFilename, library)] : []),
  ]);
  const uris = assets.length < LIST_FROM ? copies : await present(copies, library);
  for (const batch of chunk(uris, PARALLEL)) {
    await Promise.all(batch.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })));
  }
}

// The ones among these uris that are in the library's folders, each folder listed once.
async function present(uris: string[], library: LibraryPaths): Promise<string[]> {
  const folders = [
    getAssetFilesDirectory(library),
    getAssetThumbnailsDirectory(library),
    getDownloadsDirectory(library),
  ];
  const listed = await Promise.all(folders.map(async (dir) => [...(await listFiles(dir))].map((name) => dir + name)));
  const existing = new Set(listed.flat());
  return uris.filter((uri) => existing.has(uri));
}

export async function fileExists(uri: string): Promise<boolean> {
  return (await FileSystem.getInfoAsync(uri)).exists;
}

// Moves a file into a destination that doesn't exist yet (the legacy iOS move would replace one).
export async function moveFile(from: string, to: string): Promise<void> {
  await FileSystem.moveAsync({ from, to });
}
