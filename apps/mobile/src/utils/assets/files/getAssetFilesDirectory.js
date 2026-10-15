import * as FileSystem from 'expo-file-system/legacy';

import { getLibrary } from '@/library/current';

// The asset files folder of the open library, or of a library captured by work that outlives a
// screen (adding a photo, a backup run), so a late write lands in the library it belongs to.
/** @param {{ filesDir: string }} [library] */
export default function getAssetFilesDirectory(library = getLibrary()) {
  return `${FileSystem.documentDirectory}${library.filesDir}`;
}
