import { chunk } from '@squidbox/shared';
import { Directory, File, Paths } from 'expo-file-system';

import type { OpenLibrary } from './current';
import { FILE_FOLDERS, isFileName } from './fileFields';
import type { LibraryPaths } from './libraryPaths';

import {
  createAssetDirectoriesAsync,
  getAssetFileUri,
  getAssetFilesDirectory,
  getDownloadFolderUri,
  getDownloadsDirectory,
  getAssetThumbnailUri,
  getAssetThumbnailsDirectory,
  getFileFolderUri,
} from '@/utils/assets/assetStorage';
import deleteStaleDownloadsAsync from '@/utils/assets/files/deleteStaleDownloadsAsync';
import deletePath from '@/utils/files/deletePath';

// Every database file on this device, by name. expo-sqlite keeps them all in the documents' SQLite
// folder (it exists once a database has been opened).
export async function listDatabaseNames(): Promise<string[]> {
  return [...(await listFiles(new Directory(Paths.document, 'SQLite').uri))];
}

// The names of the files in a folder (none for a folder that doesn't exist). An entry's uri, and so
// its name, is percent-encoded on iOS.
export async function listFiles(dir: string): Promise<Set<string>> {
  const directory = new Directory(dir);
  return new Set(directory.exists ? directory.list().map((entry) => decodeURIComponent(entry.name)) : []);
}

// A library's folders, ready when it opens, before anything is written into them; downloads unused
// for a day go (deleteStaleDownloadsAsync).
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
  for (const dir of [
    getAssetFilesDirectory(paths),
    getAssetThumbnailsDirectory(paths),
    ...FILE_FOLDERS.map((folder) => getFileFolderUri(folder, paths)),
    getDownloadsDirectory(paths),
  ]) {
    deletePath(dir);
  }
}

// The names of an asset's files; a missing one is left alone.
export type AssetFileNames = { filename?: string; thumbnailFilename?: string };

const LIST_FROM = 100; // assets; from here, listing the folders beats a delete per absent file
const DELETES_PER_TURN = 50;

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

// The download folders of these assets that are present (getDownloadFolderUri, kept by
// withAssetFileAsync). `folders`: the downloads folder's listing.
function downloadFolders(assets: AssetFileNames[], library: LibraryPaths, folders: Set<string>): string[] {
  return assets.flatMap(({ filename }) =>
    filename && isFileName(filename) && folders.has(filename) ? [getDownloadFolderUri(filename, library)] : [],
  );
}

// A listing kept for later calls, forgotten if it fails.
function unlessFailed<T>(listing: Promise<T>, forget: () => void): Promise<T> {
  return listing.catch((error: unknown) => {
    forget();
    throw error;
  });
}

// The uris in the library's file and thumbnail folders.
async function listFolders(library: LibraryPaths): Promise<Set<string>> {
  const folders = [getAssetFilesDirectory(library), getAssetThumbnailsDirectory(library)];
  const listed = await Promise.all(folders.map(async (dir) => [...(await listFiles(dir))].map((name) => dir + name)));
  return new Set(listed.flat());
}

// Deleting is synchronous: a long sweep lets other work run between batches.
// One that fails doesn't stop the rest: the first failure is thrown once all were tried.
async function deleteAll(uris: string[]): Promise<void> {
  const failures: unknown[] = [];
  for (const batch of chunk(uris, DELETES_PER_TURN)) {
    for (const uri of batch) {
      try {
        deletePath(uri);
      } catch (error) {
        failures.push(error);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (failures.length > 0) throw failures[0];
}

export async function fileExists(uri: string): Promise<boolean> {
  return new File(uri).exists;
}

// Moves a file into a destination that doesn't exist yet: one that does makes it throw, unless
// `overwrite` replaces it.
export async function moveFile(from: string, to: string, { overwrite = false } = {}): Promise<void> {
  await new File(from).move(new File(to), { overwrite });
}

// Copies a file into a destination that doesn't exist yet, whole or not at all: to a temporary name
// next to it (a copy cut off there before is removed first), then renamed into place.
export async function copyFile(from: string, to: string): Promise<void> {
  const partial = `${to}.partial`;
  deletePath(partial);
  await new File(from).copy(new File(partial));
  await moveFile(partial, to);
}
