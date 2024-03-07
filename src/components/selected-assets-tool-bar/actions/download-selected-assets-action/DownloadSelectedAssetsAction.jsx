import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable } from 'react-native';

import ProgressModal from '@/components/ProgressModal';
import useSelectedAssets from '@/components/selected-assets-tool-bar/useSelectedAssets';
import selectedAssetsToolBarStyles from '@/styles/selectedAssetsToolBarStyles';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

export default function DownloadSelectedAssetsAction() {
  const getSelectedAssets = useSelectedAssets();
  const [progress, setProgress] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
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

  async function handlePress() {
    await saveAssetsToMediaLibraryAsync(getSelectedAssets());
  }

  return (
    <>
      <ProgressModal visible={progressVisible} progress={progress} />
      <Pressable onPress={handlePress} style={selectedAssetsToolBarStyles.button}>
        <Ionicons name="download-outline" style={selectedAssetsToolBarStyles.buttonIcon} />
      </Pressable>
    </>
  );
}
