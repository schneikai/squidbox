import { chunk } from '@squidbox/shared';
import * as FileSystem from 'expo-file-system/legacy';

import type { OpenLibrary } from './current';
import type { LibraryPaths } from './libraryPaths';

import {
  createAssetDirectoriesAsync,
  getAssetFileUri,
  getAssetFilesDirectory,
  getDownloadsDirectory,
  getAssetThumbnailUri,
  getAssetThumbnailsDirectory,
} from '@/utils/assets/assetStorage';
import deleteStaleDownloadsAsync from '@/utils/assets/files/deleteStaleDownloadsAsync';

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
  await createAssetDirectoriesAsync(library);
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
export async function removeAssetFiles(assets: AssetFileNames[], library: LibraryPaths): Promise<void> {
  await purgedFilesRemover(library)(assets);
}

// A remover of a library's files for many calls (a sweep's batches and its asset-by-asset retry):
// deleting an absent file succeeds, so while it has no listing a call for a few assets deletes
// blind; one for many lists the file and thumbnail folders once, and from then on deletes only the
// copies present. The downloads folder is listed once. A listing that fails is listed again by the
// next call.
export function purgedFilesRemover(library: LibraryPaths): (assets: AssetFileNames[]) => Promise<void> {
  let present: Promise<Set<string>> | null = null;
  let downloads: Promise<Set<string>> | null = null;
  return async (assets) => {
    if (!present && assets.length >= LIST_FROM) present = unlessFailed(listFolders(library), () => (present = null));
    downloads ??= unlessFailed(listFiles(getDownloadsDirectory(library)), () => (downloads = null));
    const [listed, folders] = await Promise.all([present, downloads]);
    const uris = [
      ...copies(assets, library).filter((uri) => !listed || listed.has(uri)),
      ...downloadFolders(assets, library, folders),
    ];
    await deleteAll(uris);
    for (const uri of uris) listed?.delete(uri);
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
function downloadFolders(assets: AssetFileNames[], library: LibraryPaths, folders: Set<string>): string[] {
  const filenames = new Set(assets.map(({ filename }) => filename));
  const directory = getDownloadsDirectory(library);
  return [...folders]
    .filter((name) => filenames.has(name.slice(0, -UUID_SUFFIX)))
    .map((name) => `${directory}${name}/`);
}

// A listing kept for later calls, forgotten if it fails.
function unlessFailed<T>(listing: Promise<T>, forget: () => void): Promise<T> {
  return listing.catch((error: unknown) => {
    forget();
    throw error;
  });
}

const UUID_SUFFIX = '-00000000-0000-0000-0000-000000000000'.length;

// The uris in the library's file and thumbnail folders.
async function listFolders(library: LibraryPaths): Promise<Set<string>> {
  const folders = [getAssetFilesDirectory(library), getAssetThumbnailsDirectory(library)];
  const listed = await Promise.all(folders.map(async (dir) => [...(await listFiles(dir))].map((name) => dir + name)));
  return new Set(listed.flat());
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

// Copies a file into a destination that doesn't exist yet, whole or not at all: to a temporary name
// next to it (a copy cut off there before is removed first), then renamed into place.
export async function copyFile(from: string, to: string): Promise<void> {
  const partial = `${to}.partial`;
  await FileSystem.deleteAsync(partial, { idempotent: true });
  await FileSystem.copyAsync({ from, to: partial });
  await FileSystem.moveAsync({ from: partial, to });
}
