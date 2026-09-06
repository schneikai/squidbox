import { Pressable, Alert } from 'react-native';

import Icon from '@/components/Icon';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors } from '@/styles/designTokens';

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
      <Icon name="add" color={colors.text} />
    </Pressable>
  );
}
