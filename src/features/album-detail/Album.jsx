import { useNavigation } from '@react-navigation/native';
import { useState, useEffect } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenHeader from './ScreenHeader';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import HeaderActions from '@/components/HeaderActions';
import SuperPressable from '@/components/SuperPressable';
import SelectedAssetsToolBar from '@/components/selected-assets-tool-bar/SelectedAssetsToolBar';
import AddSelectedAssetsToAlbumAction from '@/components/selected-assets-tool-bar/actions/add-selected-assets-to-album-action/AddSelectedAssetsToAlbumAction';
import CreatePostAction from '@/components/selected-assets-tool-bar/actions/create-post-action/CreatePostAction';
import DeleteSelectedAssetsFromAlbumAction from '@/components/selected-assets-tool-bar/actions/delete-selected-assets-from-album-action/DeleteSelectedAssetsFromAlbumAction';
import DownloadSelectedAssetsAction from '@/components/selected-assets-tool-bar/actions/download-selected-assets-action/DownloadSelectedAssetsAction';
import AddAssetAction from '@/features/album-detail/actions/AddAssetAction';
import MoreAction from '@/features/album-detail/actions/MoreAction';
import AssetList from '@/features/asset-list/AssetList';
import AssetListItem from '@/features/asset-list/AssetListItem';
import FilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/FilterAssetsAction';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import SortAssetsAction from '@/features/asset-list/actions/sort-assets-action/SortAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import ToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/ToggleSelectAssetsAction';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssets from '@/features/assets-context/useAssets';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';

export default function Album({ album }) {
  const { assets, toggleFavoriteAsset } = useAssets();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [assetIds, setAssetIds] = useState();
  const { listRef, listScrollTop } = useAssetList();
  const { isSelectMode, selectedAssetIds, toggleSelectMode, toggleSelectAsset } = useToggleSelectAssetsAction();
  const { sortOrder, sortFunction, sortAssets } = useSortAssetsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const { asset: quickViewAsset, open: openAssetQuickView, close: closeAssetQuickView } = useAssetQuickViewModal();

  useEffect(() => {
    const albumAssets = getAlbumAssets(album, assets);
    const assetIds = prepareAssets({
      assets: albumAssets,
      sortFn: sortFunction,
      filterFn: matchFilter,
    }).map((asset) => asset.id);
    setAssetIds(assetIds);
  }, [album, assets, sortOrder, activeFilter]);

  function onPressAsset(asset) {
    if (isSelectMode) {
      toggleSelectAsset(asset.id);
    } else {
      navigation.navigate('AlbumAssetScreen', { assetId: asset.id, assetIds });
    }
  }

  function handleBackPress() {
    navigation.goBack();
  }

  return (
    <>
      <AssetQuickViewModal asset={quickViewAsset} isVisible={!!quickViewAsset} />
      <AssetList
        listRef={listRef}
        assetIds={assetIds}
        renderListItem={(asset) => (
          <SuperPressable
            onPress={() => onPressAsset(asset)}
            onDoublePress={() => toggleFavoriteAsset(asset)}
            onLongPress={() => openAssetQuickView(asset)}
            onLongPressOut={() => closeAssetQuickView()}
            style={{ flex: 1 }}
          >
            <AssetListItem
              asset={asset}
              isSelected={selectedAssetIds.includes(asset.id)}
              showLastPostedAt={sortOrder.includes('lastPostedAt')}
            />
          </SuperPressable>
        )}
        ListHeaderComponent={
          <>
            <ScreenHeader album={album} numberOfAssets={assetIds?.length} onPressBack={handleBackPress} insets={insets}>
              <HeaderActions>
                {!isSmartAlbum(album) && <AddAssetAction album={album} />}
                <ToggleSelectAssetsAction isSelectMode={isSelectMode} onPress={toggleSelectMode} />
                <SortAssetsAction sortOrder={sortOrder} onPress={sortAssets} />
                <FilterAssetsAction activeFilter={activeFilter} onPress={toggleFilter} />
                {!isSmartAlbum(album) && <MoreAction album={album} afterDelete={handleBackPress} />}
              </HeaderActions>
            </ScreenHeader>
            {!!album.archivedAt && (
              <View style={styles.flagContainer}>
                <Text style={styles.albumIsArchived}>Archived</Text>
              </View>
            )}
          </>
        }
      />
      {isSelectMode && (
        <SelectedAssetsToolBar selectedAssetIds={selectedAssetIds} allAssetIds={assetIds}>
          <DownloadSelectedAssetsAction />
          <AddSelectedAssetsToAlbumAction />
          <CreatePostAction />
          {!isSmartAlbum(album) && (
            <DeleteSelectedAssetsFromAlbumAction album={album} afterAction={() => toggleSelectMode()} />
          )}
        </SelectedAssetsToolBar>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flagContainer: {
    alignSelf: 'left',
    padding: 10,
    marginTop: -10,
  },
  albumIsArchived: {
    backgroundColor: 'pink',
    padding: 4,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '800',
    zIndex: 1,
  },
});
