import * as FileSystem from 'expo-file-system/legacy';

import { getLibrary } from '@/library/current';

// The thumbnails folder of the open library, or of a captured one (see getAssetFilesDirectory).
/** @param {{ thumbnailsDir: string }} [library] */
export default function getAssetThumbnailsDirectory(library = getLibrary()) {
  return `${FileSystem.documentDirectory}${library.thumbnailsDir}`;
}
