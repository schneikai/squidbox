import { useActionSheet } from '@expo/react-native-action-sheet';
import { Text } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import Icon from '@/components/Icon';
import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import popupMenuStyles from '@/styles/popupMenuStyles';
import { colors, spacing } from '@/styles/designTokens';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

export default function DeleteFromAlbumSelectionMenuOption({ getSelectedAssets, album, afterAction }) {
  const { setAssetsDeleted } = useAssets();
  const { removeAssetsFromAlbum } = useAlbums();
  const { showActionSheetWithOptions } = useActionSheet();

  function handleSelect() {
    const selectedAssets = getSelectedAssets();

    showActionSheetWithOptions(
      {
        options: ['Remove from album', 'Delete', 'Cancel'],
        cancelButtonIndex: 2,
        title: `${getAssetCountInfo(selectedAssets).toLowerCase()} selected`,
      },
      async (selectedIndex) => {
        switch (selectedIndex) {
          case 0: {
            removeAssetsFromAlbum(album, selectedAssets);
            break;
          }
          case 1: {
            setAssetsDeleted(selectedAssets.map((asset) => asset.id));
            if (afterAction) afterAction();
            break;
          }
        }
      },
    );
  }

  return (
    <MenuOption onSelect={handleSelect} customStyles={{ optionWrapper: { ...popupMenuStyles.menuOption, ...popupMenuStyles.menuOptionLast } }}>
      <Text style={popupMenuStyles.menuOptionText}>Delete</Text>
      <Icon name="trash" size={spacing.menuIconSize} color={colors.danger} style={popupMenuStyles.menuOptionIcon} />
    </MenuOption>
  );
}
