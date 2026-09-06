// Select images and videos from the device.
// https://docs.expo.dev/versions/latest/sdk/imagepicker/
import * as ImagePicker from 'expo-image-picker';

import askForMediaLibraryPermissionViaSettings from './askForMediaLibraryPermissionViaSettings';
import getMediaLibraryPermissionAsync from './getMediaLibraryPermissionAsync';

export default async function pickImageFromMediaLibrary() {
  const hasPermission = await getMediaLibraryPermissionAsync();

  if (!hasPermission) {
    askForMediaLibraryPermissionViaSettings();
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
  });

  if (result.canceled) return [];

  return result.assets;
}
