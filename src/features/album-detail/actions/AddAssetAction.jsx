import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import ProgressModal from '@/components/ProgressModal';
import TextMenuOption from '@/components/popup-menu-options/TextMenuOption';
import { UPLOAD_MEDIA_FROM_DEVICE, UPLOAD_MEDIA_FROM_APP } from '@/constants';
import useAlbums from '@/features/albums-context/useAlbums';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';
import headerActionStyles from '@/styles/headerActionStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function AddAssetAction({ album }) {
  const { addAssetsToAlbum } = useAlbums();
  const { openAssetPicker } = useAssetPicker();
  const [progress, setProgress] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const addAssetsFromCameraRollAsync = useAddAssetsFromCameraRoll({
    onStart: () => {
      setProgressVisible(true);
    },
    onProgress: (progress) => {
      setProgress(progress);
    },
    onFinish: () => {
      setProgressVisible(false);
      setProgress(0);
    },
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
    <>
      <ProgressModal visible={progressVisible} progress={progress} />
      <Menu>
        <MenuTrigger customStyles={{ triggerWrapper: headerActionStyles.button }}>
          <Ionicons name="add" style={headerActionStyles.buttonIcon} />
        </MenuTrigger>
        <MenuOptions customStyles={popupMenuStyles.menuOptions}>
          <MenuOptions customStyles={popupMenuStyles.menuOptions}>
            <TextMenuOption label={UPLOAD_MEDIA_FROM_DEVICE} onPress={handleAddAssetsFromDevice} />
            <TextMenuOption label={UPLOAD_MEDIA_FROM_APP} onPress={handleAddAssetsFromApp} isLast />
          </MenuOptions>
        </MenuOptions>
      </Menu>
    </>
  );
}
