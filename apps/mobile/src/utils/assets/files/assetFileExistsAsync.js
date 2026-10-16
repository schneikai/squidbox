import getAssetFileUri from './getAssetFileUri';

import { fileExists } from '@/library/fs';

export default function assetFileExistsAsync(filename, library) {
  return fileExists(getAssetFileUri(filename, library));
}
