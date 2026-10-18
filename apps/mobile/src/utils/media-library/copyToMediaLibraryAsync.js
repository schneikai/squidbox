import * as ExpoMediaLibrary from 'expo-media-library';

import { MEDIA_LIBRARY_ALBUM_NAME } from '@/constants';

// Copies a file into the camera roll's app album. Needs the Photos permission (asked beforehand).
export default async function copyToMediaLibraryAsync(fileUri) {
  const mediaLibraryAsset = await ExpoMediaLibrary.createAssetAsync(fileUri);
  const album = await ExpoMediaLibrary.getAlbumAsync(MEDIA_LIBRARY_ALBUM_NAME);

  if (album) {
    await ExpoMediaLibrary.addAssetsToAlbumAsync([mediaLibraryAsset], album, false);
  } else {
    await ExpoMediaLibrary.createAlbumAsync(MEDIA_LIBRARY_ALBUM_NAME, mediaLibraryAsset, false);
  }
}
