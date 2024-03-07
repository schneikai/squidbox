import { useActionSheet } from '@expo/react-native-action-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import useSelectedAssets from '@/components/selected-assets-tool-bar/useSelectedAssets';
import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import selectedAssetsToolBarStyles from '@/styles/selectedAssetsToolBarStyles';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

export default function DeleteSelectedAssetsFromAlbumAction({ album, afterAction }) {
  const { setAssetsDeleted } = useAssets();
  const { removeAssetsFromAlbum } = useAlbums();
  const getSelectedAssets = useSelectedAssets();
  const { showActionSheetWithOptions } = useActionSheet();

  async function handlePress() {
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
    <Pressable onPress={handlePress} style={selectedAssetsToolBarStyles.button}>
      <Ionicons
        name="trash-outline"
        style={[selectedAssetsToolBarStyles.buttonIcon, selectedAssetsToolBarStyles.buttonIconDanger]}
      />
    </Pressable>
  );
}
