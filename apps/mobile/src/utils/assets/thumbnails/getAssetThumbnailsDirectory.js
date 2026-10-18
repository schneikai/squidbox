import * as FileSystem from 'expo-file-system/legacy';

// The thumbnails folder of `library` (see getAssetFilesDirectory).
/** @param {{ thumbnailsDir: string }} library */
export default function getAssetThumbnailsDirectory(library) {
  return `${FileSystem.documentDirectory}${library.thumbnailsDir}`;
}
