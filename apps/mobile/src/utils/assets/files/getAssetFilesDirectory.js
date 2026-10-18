import * as FileSystem from 'expo-file-system/legacy';

// The asset files folder of `library`: always passed (useLibrary().paths, or the library a flow
// started with), so a late write lands in the library it belongs to.
/** @param {{ filesDir: string }} library */
export default function getAssetFilesDirectory(library) {
  return `${FileSystem.documentDirectory}${library.filesDir}`;
}
