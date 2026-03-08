import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useSelectedAssets from '@/components/selected-assets-tool-bar/useSelectedAssets';
import selectedAssetsToolBarStyles from '@/styles/selectedAssetsToolBarStyles';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

export default function DownloadSelectedAssetsAction() {
  const getSelectedAssets = useSelectedAssets();
  const { show, hide, updateProgress } = useProgressOverlay();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  async function handlePress() {
    await saveAssetsToMediaLibraryAsync(getSelectedAssets());
  }

  return (
    <Pressable onPress={handlePress} style={selectedAssetsToolBarStyles.button}>
      <Ionicons name="download-outline" style={selectedAssetsToolBarStyles.buttonIcon} />
    </Pressable>
  );
}
