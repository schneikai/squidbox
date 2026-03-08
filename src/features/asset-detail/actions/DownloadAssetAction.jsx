import Octicons from '@expo/vector-icons/Octicons';
import { Pressable } from 'react-native';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import headerActionStyles from '@/styles/headerActionStyles';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

export default function DownloadAssetAction({ asset }) {
  const { show, hide, updateProgress } = useProgressOverlay();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  async function handlePress() {
    await saveAssetsToMediaLibraryAsync([asset]);
  }

  return (
    <Pressable onPress={handlePress} style={headerActionStyles.button}>
      <Octicons name="download" style={headerActionStyles.buttonIcon} />
    </Pressable>
  );
}
