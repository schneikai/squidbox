import * as FileSystem from 'expo-file-system/legacy';

import getAssetThumbnailsDirectory from './getAssetThumbnailsDirectory';

export default async function createAssetThumbnailDirectory(library) {
  return FileSystem.makeDirectoryAsync(getAssetThumbnailsDirectory(library), { intermediates: true });
}
