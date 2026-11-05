import { Album, Asset } from 'expo-media-library';

import { MEDIA_LIBRARY_ALBUM_NAME } from '@/constants';

// Copies a file into the camera roll's app album. Needs the Photos permission (asked beforehand).
export default async function copyToMediaLibraryAsync(fileUri: string): Promise<void> {
  const album = await Album.get(MEDIA_LIBRARY_ALBUM_NAME);
  if (album) {
    await Asset.create(fileUri, album);
  } else {
    await Album.create(MEDIA_LIBRARY_ALBUM_NAME, [fileUri]);
  }
}
