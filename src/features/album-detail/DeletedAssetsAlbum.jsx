import { useNavigation } from '@react-navigation/native';
import { useState, useEffect } from 'react';
import { Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenHeader from './ScreenHeader';

import ActionButton from '@/components/ActionButton';
import HeaderActions from '@/components/HeaderActions';
import AssetList from '@/features/asset-list/AssetList';
import AssetListItem from '@/features/asset-list/AssetListItem';
import ToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/ToggleSelectAssetsAction';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssets from '@/features/assets-context/useAssets';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';

export default function AlbumScreenComponentForDeletedAssets({ album }) {
  const { assets, restoreDeletedAssets, deleteAssetsAsync } = useAssets();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [assetIds, setAssetIds] = useState();
  const [isDeleting, setIsDeleting] = useState(false);
  const { isSelectMode, selectedAssetIds, toggleSelectMode, toggleSelectAsset } = useToggleSelectAssetsAction();

  useEffect(() => {
    const albumAssets = getAlbumAssets(album, Object.values(assets));
    const assetIds = prepareAssets({ assets: albumAssets, filterDeleted: false }).map((asset) => asset.id);
    setAssetIds(assetIds);
  }, [album, assets]);

  function handleRestoreAssets() {
    const title = isSelectMode ? 'Restore selected' : 'Restore all';
    const message = isSelectMode
      ? 'Are you sure you want to restore the selected deleted assets?'
      : 'Are you sure you want to restore all deleted assets?';

    Alert.alert(title, message, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
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

    const assetsToDelete = isSelectMode
      ? selectedAssetIds.map((assetId) => assets[assetId])
      : assetIds.map((assetId) => assets[assetId]);

    const title = isSelectMode ? 'Delete selected' : 'Delete all';
    const message = isSelectMode
      ? 'Are you sure you want to permanently delete the selected assets?'
      : 'Are you sure you want to permanently delete all deleted assets?';

    Alert.alert(title, message, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        onPress: async () => {
          setIsDeleting(true);

          try {
            await deleteAssetsAsync(assetsToDelete);
            if (isSelectMode) toggleSelectMode();
          } catch (error) {
            Alert.alert('Failed to delete assets!', error.message);
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <AssetList
      assetIds={assetIds}
      renderListItem={(asset) => {
        if (!asset) return null;
        if (isSelectMode) {
          return (
            <Pressable style={{ flex: 1 }} onPress={() => toggleSelectAsset(asset.id)}>
              <DeletedAssetListItem asset={asset} isSelected={selectedAssetIds.includes(asset.id)} />
            </Pressable>
          );
        }
        return <DeletedAssetListItem asset={asset} />;
      }}
      ListHeaderComponent={
        <ScreenHeader
          album={album}
          numberOfAssets={assetIds?.length}
          onPressBack={() => navigation.goBack()}
          insets={insets}
        >
          <HeaderActions>
            <ActionButton iconName="ios-arrow-undo-outline" onPress={handleRestoreAssets} />
            <ToggleSelectAssetsAction isSelectMode={isSelectMode} onPress={toggleSelectMode} />
            <ActionButton iconName="trash-outline" destructive onPress={handleDeleteAssets} />
          </HeaderActions>
        </ScreenHeader>
      }
    />
  );
}

function DeletedAssetListItem({ asset, isSelected }) {
  return <AssetListItem asset={asset} isSelected={isSelected} />;
}
