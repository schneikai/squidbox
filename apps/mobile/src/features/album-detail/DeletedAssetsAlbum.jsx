import { useNavigation } from '@react-navigation/native';
import { useMemo, useTransition } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import Page from '@/components/Page';
import PillButton from '@/components/PillButton';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import AssetList from '@/features/asset-list/AssetList';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetCells from '@/features/asset-list/useAssetCells';
import useAssets from '@/features/assets-context/useAssets';
import useScreenPadding from '@/hooks/useScreenPadding';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';

export default function AlbumScreenComponentForDeletedAssets({ album }) {
  const { assets, restoreDeletedAssets, deleteAssetsAsync } = useAssets();
  const navigation = useNavigation();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');

  const [isDeleting, startDeleteTransition] = useTransition();
  const { isSelectMode, selectedAssetIds, isAssetSelected, toggleSelectMode, toggleSelectAsset } =
    useToggleSelectAssetsAction();

  const assetIds = useMemo(
    () => prepareAssets({ assets: getAlbumAssets(album, assets), filterDeleted: false }).map((asset) => asset.id),
    [album, assets],
  );

  function handleRestoreAssets() {
    const title = isSelectMode ? 'Restore selected' : 'Restore all';
    const message = isSelectMode
      ? 'Are you sure you want to restore the selected deleted assets?'
      : 'Are you sure you want to restore all deleted assets?';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: () => {
          restoreDeletedAssets(isSelectMode ? selectedAssetIds : assetIds);
          if (isSelectMode) toggleSelectMode();
        },
      },
    ]);
  }

  function handleDeleteAssets() {
    if (isDeleting) {
      Alert.alert('Deleting assets', 'Please wait until the current deletion is finished.');
      return;
    }

    const assetsToDelete = isSelectMode ? selectedAssetIds.map((id) => assets[id]) : assetIds.map((id) => assets[id]);

    const title = isSelectMode ? 'Delete selected' : 'Delete all';
    const message = isSelectMode
      ? 'Are you sure you want to permanently delete the selected assets?'
      : 'Are you sure you want to permanently delete all deleted assets?';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: () => {
          startDeleteTransition(async () => {
            try {
              await deleteAssetsAsync(assetsToDelete);
              if (isSelectMode) toggleSelectMode();
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
    canFavorite: false,
    canPeek: false,
  });

  return (
    <Page>
      <FloatingDetailHeader
        title={album.name}
        onBack={() => navigation.goBack()}
        menuSlot={
          <View style={styles.menuRow}>
            <PillButton iconName="undo" onPress={handleRestoreAssets} />
            <PillButton iconName="checkbox" onPress={toggleSelectMode} />
            <PillButton iconName="trash" onPress={handleDeleteAssets} danger />
          </View>
        }
      />
      <AssetList
        assetIds={assetIds}
        contentContainerStyle={{ paddingTop, paddingBottom }}
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
