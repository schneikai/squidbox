import { useNavigation } from '@react-navigation/native';
import { useMemo, useTransition } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import IconButton from '@/components/IconButton';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import AssetList from '@/features/asset-list/AssetList';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetCells from '@/features/asset-list/useAssetCells';
import useAssets from '@/features/assets-context/useAssets';
import useScreenPadding from '@/hooks/useScreenPadding';
import { colors } from '@/styles/designTokens';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';

export default function AlbumScreenComponentForDeletedAssets({ album }) {
  const { assets, restoreDeletedAssets, deleteAssetsAsync } = useAssets();
  const navigation = useNavigation();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');

  const [isDeleting, startDeleteTransition] = useTransition();
  const { isSelectMode, selectedAssetIds, isAssetSelected, toggleSelectMode, exitSelectMode, toggleSelectAsset } =
    useToggleSelectAssetsAction();

  const assetIds = useMemo(
    () => prepareAssets({ assets: getAlbumAssets(album, assets), filterDeleted: false }).map((asset) => asset.id),
    [album, assets],
  );

  // Select mode acts on the selection, otherwise on every deleted asset.
  const targetIds = isSelectMode ? selectedAssetIds : assetIds;

  function handleRestoreAssets() {
    const message = isSelectMode
      ? 'Are you sure you want to restore the selected deleted assets?'
      : 'Are you sure you want to restore all deleted assets?';

    Alert.alert(isSelectMode ? 'Restore selected' : 'Restore all', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: () => {
          restoreDeletedAssets(targetIds);
          exitSelectMode();
        },
      },
    ]);
  }

  function handleDeleteAssets() {
    if (isDeleting) {
      Alert.alert('Deleting assets', 'Please wait until the current deletion is finished.');
      return;
    }

    const message = isSelectMode
      ? 'Are you sure you want to permanently delete the selected assets?'
      : 'Are you sure you want to permanently delete all deleted assets?';

    Alert.alert(isSelectMode ? 'Delete selected' : 'Delete all', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: () => {
          startDeleteTransition(async () => {
            try {
              await deleteAssetsAsync(targetIds);
              exitSelectMode();
            } catch (error) {
              Alert.alert('Failed to delete assets!', error.message);
            }
          });
        },
      },
    ]);
  }

  const { renderCell } = useAssetCells({
    onPress: isSelectMode ? (asset) => toggleSelectAsset(asset.id) : undefined,
    isAssetSelected,
    canPeek: false,
  });

  return (
    <Page>
      <FloatingDetailHeader
        title={album.name}
        onBack={() => navigation.goBack()}
        menuSlot={
          <View style={styles.menuRow}>
            <IconButton icon="undo" onPress={handleRestoreAssets} />
            <IconButton icon="checkbox" onPress={toggleSelectMode} />
            <IconButton icon="trash" onPress={handleDeleteAssets} color={colors.danger} />
          </View>
        }
      />
      <AssetList
        assetIds={assetIds}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        renderListItem={renderCell}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
