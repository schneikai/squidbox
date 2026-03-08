import * as FileSystem from 'expo-file-system/legacy';

import getAssetFileUri from './getAssetFileUri';

export default async function deleteAssetFileAsync(filename) {
  const fileUri = getAssetFileUri(filename);
  await FileSystem.deleteAsync(fileUri, { idempotent: true });
}
