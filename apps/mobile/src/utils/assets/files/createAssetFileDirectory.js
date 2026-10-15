import * as FileSystem from 'expo-file-system/legacy';

import getAssetFilesDirectory from './getAssetFilesDirectory';

export default async function createAssetFileDirectory(library) {
  return FileSystem.makeDirectoryAsync(getAssetFilesDirectory(library), { intermediates: true });
}
