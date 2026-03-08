import { useActionSheet } from '@expo/react-native-action-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import popupMenuStyles from '@/styles/popupMenuStyles';
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
      <Ionicons name="trash-outline" style={popupMenuStyles.menuOptionIcon} />
    </MenuOption>
  );
}
