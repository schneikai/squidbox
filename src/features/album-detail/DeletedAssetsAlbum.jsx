import { useNavigation } from '@react-navigation/native';
import { useState, useMemo, useTransition } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import Icon from '@/components/Icon';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import AssetList from '@/features/asset-list/AssetList';
import AssetListItem from '@/features/asset-list/AssetListItem';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssets from '@/features/assets-context/useAssets';
import useScreenPadding from '@/hooks/useScreenPadding';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors } from '@/styles/designTokens';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';

export default function AlbumScreenComponentForDeletedAssets({ album }) {
  const { assets, restoreDeletedAssets, deleteAssetsAsync } = useAssets();
  const navigation = useNavigation();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');

  const [isDeleting, startDeleteTransition] = useTransition();
  const { isSelectMode, selectedAssetIds, toggleSelectMode, toggleSelectAsset } = useToggleSelectAssetsAction();

  const assetIds = useMemo(
    () =>
      prepareAssets({ assets: getAlbumAssets(album, Object.values(assets)), filterDeleted: false }).map(
        (asset) => asset.id,
      ),
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

  return (
    <Page>
      <FloatingDetailHeader
        title={album.name}
        onBack={() => navigation.goBack()}
        menuSlot={
          <View style={styles.menuRow}>
            <Pressable
              onPress={handleRestoreAssets}
              style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
              hitSlop={4}
            >
              <Icon name="undo" color={colors.text} />
            </Pressable>
            <Pressable
              onPress={toggleSelectMode}
              style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
              hitSlop={4}
            >
              <Icon name="checkbox" color={colors.text} />
            </Pressable>
            <Pressable
              onPress={handleDeleteAssets}
              style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
              hitSlop={4}
            >
              <Icon name="trash" color={colors.danger} />
            </Pressable>
          </View>
        }
      />
      <AssetList
        assetIds={assetIds}
        contentContainerStyle={{ paddingTop, paddingBottom }}
        renderListItem={(asset) => {
          if (!asset) return null;
          if (isSelectMode) {
            return (
              <Pressable style={{ flex: 1 }} onPress={() => toggleSelectAsset(asset.id)}>
                <AssetListItem asset={asset} isSelected={selectedAssetIds.includes(asset.id)} />
              </Pressable>
            );
          }
          return <AssetListItem asset={asset} />;
        }}
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
