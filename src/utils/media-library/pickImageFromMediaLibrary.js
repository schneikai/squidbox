// Select images and videos from the device.
// https://docs.expo.dev/versions/latest/sdk/imagepicker/
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

import askForMediaLibraryPermissionViaSettings from './askForMediaLibraryPermissionViaSettings';
import getMediaLibraryPermissionAsync from './getMediaLibraryPermissionAsync';

export default async function pickImageFromMediaLibrary() {
  const hasPermission = await getMediaLibraryPermissionAsync();

  if (!hasPermission) {
    askForMediaLibraryPermissionViaSettings();
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsMultipleSelection: true,
  });

  if (result.canceled) return [];

  await addIsFavorite(result.assets);

  return result.assets;
}

async function addIsFavorite(assets) {
  for (const asset of assets) {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.assetId);
    asset.isFavorite = assetInfo.isFavorite;
  }
}
