import { useActionSheet } from '@expo/react-native-action-sheet';
import { Alert } from 'react-native';

import { UPLOAD_MEDIA_FROM_DEVICE, UPLOAD_MEDIA_FROM_APP } from '@/constants';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';

export default function useAssetPickerHandler({ addAssetsToPost, onStart, onProgress, onFinish }) {
  const addAssetsFromCameraRollAsync = useAddAssetsFromCameraRoll({
    onStart,
    onProgress,
    onFinish,
  });
  const { showActionSheetWithOptions } = useActionSheet();
  const { openAssetPicker } = useAssetPicker();

  async function handleAddAssets() {
    try {
      showActionSheetWithOptions(
        {
          options: [UPLOAD_MEDIA_FROM_DEVICE, UPLOAD_MEDIA_FROM_APP, 'Cancel'],
          cancelButtonIndex: 2,
        },
        async (selectedIndex) => {
          switch (selectedIndex) {
            case 0: {
              const assets = await addAssetsFromCameraRollAsync();
              addAssetsToPost(assets);
              break;
            }
            case 1: {
              const { assets } = await openAssetPicker();
              addAssetsToPost(assets);
              break;
            }
          }
        },
      );
    } catch (error) {
      Alert.alert('Failed to add assets!', error.message);
    }
  }

  return handleAddAssets;
}
