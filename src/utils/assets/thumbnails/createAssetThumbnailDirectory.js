import * as FileSystem from 'expo-file-system';

import { ASSET_THUMBNAIL_PATH } from './constants';

export default async function createAssetThumbnailDirectory() {
  return FileSystem.makeDirectoryAsync(ASSET_THUMBNAIL_PATH, { intermediates: true });
}
