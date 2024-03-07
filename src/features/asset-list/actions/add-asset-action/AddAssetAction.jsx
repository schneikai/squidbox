import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Alert } from 'react-native';

import ProgressModal from '@/components/ProgressModal';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';
import headerActionStyles from '@/styles/headerActionStyles';

export default function AddAssetAction() {
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

  async function handleAddAssets() {
    try {
      await addAssetsFromCameraRollAsync();
    } catch (error) {
      Alert.alert('Failed to add assets!', error.message);
    }
  }

  return (
    <>
      <ProgressModal visible={progressVisible} progress={progress} />
      <Pressable onPress={handleAddAssets} style={[headerActionStyles.button, { marginRight: 20 }]}>
        <Ionicons name="add" style={headerActionStyles.buttonIcon} />
      </Pressable>
    </>
  );
}
