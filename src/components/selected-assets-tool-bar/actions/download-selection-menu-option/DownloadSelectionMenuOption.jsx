import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import popupMenuStyles from '@/styles/popupMenuStyles';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

export default function DownloadSelectionMenuOption({ getSelectedAssets }) {
  const { show, hide, updateProgress } = useProgressOverlay();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  async function handleSelect() {
    await saveAssetsToMediaLibraryAsync(getSelectedAssets());
  }

  return (
    <MenuOption onSelect={handleSelect} customStyles={{ optionWrapper: popupMenuStyles.menuOption }}>
      <Text style={popupMenuStyles.menuOptionText}>Download</Text>
      <Ionicons name="download-outline" style={popupMenuStyles.menuOptionIcon} />
    </MenuOption>
  );
}
