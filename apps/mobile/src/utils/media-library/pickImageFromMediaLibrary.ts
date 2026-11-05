// Select images and videos from the device.
// https://docs.expo.dev/versions/latest/sdk/imagepicker/
import * as ImagePicker from 'expo-image-picker';

import askForMediaLibraryPermissionViaSettings from './askForMediaLibraryPermissionViaSettings';
import getMediaLibraryPermissionAsync from './getMediaLibraryPermissionAsync';

type PickOptions = Pick<
  ImagePicker.ImagePickerOptions,
  'mediaTypes' | 'allowsMultipleSelection' | 'allowsEditing' | 'aspect'
> & { onOpen?: () => void };

// `onOpen` runs right before the picker opens (only when permission is granted). The picker takes
// photos and videos, several at once, unless told otherwise (`mediaTypes`, `allowsMultipleSelection`);
// `allowsEditing` with `aspect` lets the user crop the one photo picked (a contact's square avatar).
export default async function pickImageFromMediaLibrary({
  onOpen,
  mediaTypes = ['images', 'videos'],
  allowsMultipleSelection = true,
  allowsEditing = false,
  aspect,
}: PickOptions = {}): Promise<ImagePicker.ImagePickerAsset[] | undefined> {
  const hasPermission = await getMediaLibraryPermissionAsync();

  if (!hasPermission) {
    askForMediaLibraryPermissionViaSettings();
    return;
  }

  if (onOpen) onOpen();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsMultipleSelection,
    allowsEditing,
    aspect,
    // The default page sheet shifted sideways during the picker's drag-to-select; full screen has no
    // sheet to move.
    presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
  });

  if (result.canceled) return [];

  return result.assets;
}
