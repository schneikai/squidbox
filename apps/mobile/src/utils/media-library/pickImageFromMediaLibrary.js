// Select images and videos from the device.
// https://docs.expo.dev/versions/latest/sdk/imagepicker/
import * as ImagePicker from 'expo-image-picker';

import askForMediaLibraryPermissionViaSettings from './askForMediaLibraryPermissionViaSettings';
import getMediaLibraryPermissionAsync from './getMediaLibraryPermissionAsync';

// `onOpen` runs right before the picker opens (only when permission is granted).
export default async function pickImageFromMediaLibrary({ onOpen } = {}) {
  const hasPermission = await getMediaLibraryPermissionAsync();

  if (!hasPermission) {
    askForMediaLibraryPermissionViaSettings();
    return;
  }

  if (onOpen) onOpen();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    // The default page sheet shifted sideways during the picker's drag-to-select; full screen has no
    // sheet to move.
    presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
  });

  if (result.canceled) return [];

  return result.assets;
}
