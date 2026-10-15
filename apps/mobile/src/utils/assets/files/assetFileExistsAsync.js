import * as FileSystem from 'expo-file-system/legacy';

import getAssetFileUri from './getAssetFileUri';

export default async function assetFileExistsAsync(filename, library) {
  const fileUri = getAssetFileUri(filename, library);
  const file = await FileSystem.getInfoAsync(fileUri);
  return file.exists;
}
