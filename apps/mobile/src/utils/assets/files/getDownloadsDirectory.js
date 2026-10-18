import * as FileSystem from 'expo-file-system/legacy';

// The folder full-resolution files are fetched into (to save or share), each in a folder of its own,
// per library, so a removed library leaves none of its photos behind. In the cache: the OS may clear it.
/** @param {{ downloadsDir: string }} library */
export default function getDownloadsDirectory(library) {
  return `${FileSystem.cacheDirectory}${library.downloadsDir}`;
}
