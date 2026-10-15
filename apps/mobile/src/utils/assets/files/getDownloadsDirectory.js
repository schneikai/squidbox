import * as FileSystem from 'expo-file-system/legacy';

import { getLibrary } from '@/library/current';

// The folder full-resolution files are fetched into (to save or view), per library, so a removed
// library leaves none of its photos behind. In the cache: the OS may clear it.
/** @param {{ downloadsDir: string }} [library] */
export default function getDownloadsDirectory(library = getLibrary()) {
  return `${FileSystem.cacheDirectory}${library.downloadsDir}`;
}
