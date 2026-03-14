import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Alert } from 'react-native';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';
import actionButtonStyles from '@/styles/actionButtonStyles';

export default function AddAssetAction() {
  const { show, hide, updateProgress } = useProgressOverlay();
  const addAssetsFromCameraRollAsync = useAddAssetsFromCameraRoll({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  async function handleAddAssets() {
    try {
      await addAssetsFromCameraRollAsync();
    } catch (error) {
      Alert.alert('Failed to add assets!', error.message);
    }
  }

  return (
    <Pressable onPress={handleAddAssets} style={[actionButtonStyles.button, { marginRight: 20 }]}>
      <Ionicons name="add" style={actionButtonStyles.buttonIcon} />
    </Pressable>
  );
}
