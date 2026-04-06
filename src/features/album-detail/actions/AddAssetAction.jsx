import { Alert } from 'react-native';

import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { UPLOAD_MEDIA_FROM_DEVICE, UPLOAD_MEDIA_FROM_APP } from '@/constants';
import useAlbums from '@/features/albums-context/useAlbums';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';

export default function AddAssetAction({ album }) {
  const { addAssetsToAlbum } = useAlbums();
  const { openAssetPicker } = useAssetPicker();
  const { show, hide, updateProgress } = useProgressOverlay();
  const addAssetsFromCameraRollAsync = useAddAssetsFromCameraRoll({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  async function handleAddAssetsFromDevice() {
    try {
      const assets = await addAssetsFromCameraRollAsync();
      addAssetsToAlbum(album, assets);
    } catch (error) {
      Alert.alert('Failed to add assets from device!', error.message);
    }
  }

  async function handleAddAssetsFromApp() {
    try {
      const { assets } = await openAssetPicker();
      addAssetsToAlbum(album, assets);
    } catch (error) {
      Alert.alert('Failed to add assets from app!', error.message);
    }
  }

  return (
    <PopupMenu icon="add" variant="gradient">
      <MenuOption label={UPLOAD_MEDIA_FROM_DEVICE} icon="mobile" onPress={handleAddAssetsFromDevice} />
      <MenuOption label={UPLOAD_MEDIA_FROM_APP} icon="library" onPress={handleAddAssetsFromApp} isLast />
    </PopupMenu>
  );
}
