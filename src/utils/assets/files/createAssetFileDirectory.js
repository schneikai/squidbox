import * as FileSystem from 'expo-file-system';

import { ASSET_FILE_PATH } from './constants';

export default async function createAssetFileDirectory() {
  return FileSystem.makeDirectoryAsync(ASSET_FILE_PATH, { intermediates: true });
}
