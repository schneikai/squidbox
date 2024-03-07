import * as FileSystem from 'expo-file-system';

import getDataFileUri from './getDataFileUri';
import writeLocalDataAsync from './writeLocalDataAsync';

import fileExistsAsync from '@/utils/files/fileExistsAsync';

export default async function readLocalDataAsync(filename) {
  const fileUri = getDataFileUri(filename);
  const fileExists = await fileExistsAsync(fileUri);

  if (!fileExists) {
    await writeLocalDataAsync(filename, {});
    return {};
  }

  const data = await FileSystem.readAsStringAsync(fileUri);
  return JSON.parse(data);
}
