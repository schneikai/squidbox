import { chunk } from '@squidbox/shared';
import * as FileSystem from 'expo-file-system/legacy';

import type { OpenLibrary } from './current';
import type { LibraryPaths } from './libraryPaths';

import createAssetFileDirectory from '@/utils/assets/files/createAssetFileDirectory';
import deleteStaleDownloadsAsync from '@/utils/assets/files/deleteStaleDownloadsAsync';
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

// A library's two folders, ready when it opens, before anything is written into them; downloads over
// an hour old go.
export async function createLibraryFolders(library: OpenLibrary): Promise<void> {
  await createAssetFileDirectory(library);
  await createAssetThumbnailDirectory(library);
  await deleteStaleDownloadsAsync(library);
}

// A new library that found no free database file: web only (fs.web.ts), iOS has no such limit.
export function libraryLimitMessage(_error: unknown): string | null {
  return null;
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

// These files on this device: file and downloaded copies by `filename`, thumbnail by its name.
// Deleting an absent file succeeds, so a few are deleted blind; for many the folders are listed once.
export async function removeAssetFiles(assets: AssetFileNames[], library: LibraryPaths): Promise<void> {
  if (assets.length >= LIST_FROM) return purgedFilesRemover(library)(assets);
  const downloads = [...(await listFiles(getDownloadsDirectory(library)))];
  await deleteAll([...copies(assets, library), ...downloadFolders(assets, library, downloads)]);
}

// The remover of one sweep of a library's purged files: a call for a few assets deletes blind, as
// removeAssetFiles does; the first for many lists the folders, once, and from then on only the copies
// present are deleted, so a sweep of many batches (and its asset-by-asset retry after a failed batch)
// lists nothing again.
export function purgedFilesRemover(library: LibraryPaths): (assets: AssetFileNames[]) => Promise<void> {
  let listing: Promise<{ present: Set<string>; downloads: string[] }> | null = null;
  return async (assets) => {
    if (!listing && assets.length < LIST_FROM) return removeAssetFiles(assets, library);
    listing ??= listFolders(library);
    const { present, downloads } = await listing;
    const uris = [
      ...copies(assets, library).filter((uri) => present.has(uri)),
      ...downloadFolders(assets, library, downloads),
    ];
    await deleteAll(uris);
    for (const uri of uris) present.delete(uri);
  };
}

// The uris of these assets' file and thumbnail.
function copies(assets: AssetFileNames[], library: LibraryPaths): string[] {
  return assets.flatMap(({ filename, thumbnailFilename }) => [
    ...(filename ? [getAssetFileUri(filename, library)] : []),
    ...(thumbnailFilename ? [getAssetThumbnailUri(thumbnailFilename, library)] : []),
  ]);
}

// The download folders of these assets (kept for a share sheet): `<filename>-<uuid>/`, see
// withAssetFileAsync.
function downloadFolders(assets: AssetFileNames[], library: LibraryPaths, folders: string[]): string[] {
  const filenames = new Set(assets.map(({ filename }) => filename));
  const directory = getDownloadsDirectory(library);
  return folders.filter((name) => filenames.has(name.slice(0, -UUID_SUFFIX))).map((name) => `${directory}${name}/`);
}

const UUID_SUFFIX = '-00000000-0000-0000-0000-000000000000'.length;

// The uris in the library's file and thumbnail folders, and the names in its downloads folder.
async function listFolders(library: LibraryPaths): Promise<{ present: Set<string>; downloads: string[] }> {
  const folders = [getAssetFilesDirectory(library), getAssetThumbnailsDirectory(library)];
  const listed = await Promise.all(folders.map(async (dir) => [...(await listFiles(dir))].map((name) => dir + name)));
  return { present: new Set(listed.flat()), downloads: [...(await listFiles(getDownloadsDirectory(library)))] };
}

async function deleteAll(uris: string[]): Promise<void> {
  for (const batch of chunk(uris, PARALLEL)) {
    await Promise.all(batch.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })));
  }
}

export async function fileExists(uri: string): Promise<boolean> {
  return (await FileSystem.getInfoAsync(uri)).exists;
}

// Moves a file into a destination that doesn't exist yet (the legacy iOS move would replace one).
export async function moveFile(from: string, to: string): Promise<void> {
  await FileSystem.moveAsync({ from, to });
}
