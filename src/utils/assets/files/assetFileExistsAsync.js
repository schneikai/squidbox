import * as FileSystem from 'expo-file-system';

import getAssetFileUri from './getAssetFileUri';

export default async function assetFileExistsAsync(filename) {
  const fileUri = getAssetFileUri(filename);
  const file = await FileSystem.getInfoAsync(fileUri);
  return file.exists;
}
