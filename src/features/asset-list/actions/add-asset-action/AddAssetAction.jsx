import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Alert } from 'react-native';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';
import headerActionStyles from '@/styles/headerActionStyles';

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
    <Pressable onPress={handleAddAssets} style={[headerActionStyles.button, { marginRight: 20 }]}>
      <Ionicons name="add" style={headerActionStyles.buttonIcon} />
    </Pressable>
  );
}
