import * as ExpoMediaLibrary from 'expo-media-library';

import askForMediaLibraryPermissionViaSettings from './askForMediaLibraryPermissionViaSettings';
import getMediaLibraryPermissionAsync from './getMediaLibraryPermissionAsync';

import { MEDIA_LIBRARY_ALBUM_NAME } from '@/constants';

export default async function copyToMediaLibraryAsync(fileUri) {
  const hasPermission = await getMediaLibraryPermissionAsync();

  if (!hasPermission) {
    askForMediaLibraryPermissionViaSettings();
    return;
  }

  const mediaLibraryAsset = await ExpoMediaLibrary.createAssetAsync(fileUri);
  const album = await ExpoMediaLibrary.getAlbumAsync(MEDIA_LIBRARY_ALBUM_NAME);

  if (album) {
    await ExpoMediaLibrary.addAssetsToAlbumAsync([mediaLibraryAsset], album, false);
  } else {
    await ExpoMediaLibrary.createAlbumAsync(MEDIA_LIBRARY_ALBUM_NAME, mediaLibraryAsset, false);
  }
}
