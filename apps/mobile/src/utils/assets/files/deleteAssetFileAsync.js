import * as FileSystem from 'expo-file-system/legacy';

import getAssetFileUri from './getAssetFileUri';

export default async function deleteAssetFileAsync(filename, library) {
  const fileUri = getAssetFileUri(filename, library);
  await FileSystem.deleteAsync(fileUri, { idempotent: true });
}
