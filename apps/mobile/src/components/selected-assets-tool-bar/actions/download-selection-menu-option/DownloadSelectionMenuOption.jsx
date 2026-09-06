import { Text } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import Icon from '@/components/Icon';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import { colors, spacing } from '@/styles/designTokens';
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
      <Icon
        name="download"
        size={spacing.menuIconSize}
        color={colors.darkModalTextDim}
        style={popupMenuStyles.menuOptionIcon}
      />
    </MenuOption>
  );
}
