import Octicons from '@expo/vector-icons/Octicons';
import { useState } from 'react';
import { Pressable } from 'react-native';

import ProgressModal from '@/components/ProgressModal';
import headerActionStyles from '@/styles/headerActionStyles';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

export default function DownloadAssetAction({ asset }) {
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
    await saveAssetsToMediaLibraryAsync([asset]);
  }

  return (
    <>
      <ProgressModal visible={progressVisible} progress={progress} />
      <Pressable onPress={handlePress} style={headerActionStyles.button}>
        <Octicons name="download" style={headerActionStyles.buttonIcon} />
      </Pressable>
    </>
  );
}
