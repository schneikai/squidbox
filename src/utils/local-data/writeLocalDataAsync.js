import * as FileSystem from 'expo-file-system';

import getDataFileUri from './getDataFileUri';

export default async function writeLocalDataAsync(filename, data) {
  const fileUri = getDataFileUri(filename);
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data));
}
