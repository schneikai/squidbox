import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import HeaderActions from '@/components/HeaderActions';
import SuperPressable from '@/components/SuperPressable';
import ScreenHeader from '@/components/screen-header/ScreenHeader';
import SelectedAssetsToolBar from '@/components/selected-assets-tool-bar/SelectedAssetsToolBar';
import AddSelectedAssetsToAlbumAction from '@/components/selected-assets-tool-bar/actions/add-selected-assets-to-album-action/AddSelectedAssetsToAlbumAction';
import CreatePostAction from '@/components/selected-assets-tool-bar/actions/create-post-action/CreatePostAction';
import DeleteSelectedAssetsAction from '@/components/selected-assets-tool-bar/actions/delete-selected-assets-action/DeleteSelectedAssetsAction';
import DownloadSelectedAssetsAction from '@/components/selected-assets-tool-bar/actions/download-selected-assets-action/DownloadSelectedAssetsAction';
import AssetList from '@/features/asset-list/AssetList';
import AssetListItem from '@/features/asset-list/AssetListItem';
import AddAssetAction from '@/features/asset-list/actions/add-asset-action/AddAssetAction';
import FilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/FilterAssetsAction';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import MoreAction from '@/features/asset-list/actions/more-action/MoreAction';
import SortAssetsAction from '@/features/asset-list/actions/sort-assets-action/SortAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import ToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/ToggleSelectAssetsAction';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssets from '@/features/assets-context/useAssets';

export default function AssetsScreen({ route, navigation }) {
  const { assets, toggleFavoriteAsset } = useAssets();
  const insets = useSafeAreaInsets();
  const [assetIds, setAssetIds] = useState();

  const { listRef, listScrollTop } = useAssetList();
  const { isSelectMode, selectedAssetIds, toggleSelectMode, toggleSelectAsset } = useToggleSelectAssetsAction();
  const { sortOrder, sortFunction, sortAssets } = useSortAssetsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const { asset: quickViewAsset, open: openAssetQuickView, close: closeAssetQuickView } = useAssetQuickViewModal();

  useEffect(() => {
    const assetIds = prepareAssets({
      assets: Object.values(assets),
      sortFn: sortFunction,
      filterFn: matchFilter,
    }).map((asset) => asset.id);
    setAssetIds(assetIds);
  }, [assets, sortOrder, activeFilter]);

  function onPressAsset(asset) {
    if (isSelectMode) {
      toggleSelectAsset(asset.id);
    } else {
      navigation.navigate('AssetScreen', { assetId: asset.id, assetIds });
    }
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
          <ScreenHeader label="Assets" insets={insets}>
            <HeaderActions>
              <AddAssetAction />
              <ToggleSelectAssetsAction isSelectMode={isSelectMode} onPress={toggleSelectMode} />
              <SortAssetsAction sortOrder={sortOrder} onPress={sortAssets} />
              <FilterAssetsAction activeFilter={activeFilter} onPress={toggleFilter} />
              <MoreAction />
            </HeaderActions>
          </ScreenHeader>
        }
      />
      {isSelectMode && (
        <SelectedAssetsToolBar selectedAssetIds={selectedAssetIds} allAssetIds={assetIds}>
          <DownloadSelectedAssetsAction />
          <AddSelectedAssetsToAlbumAction />
          <CreatePostAction />
          <DeleteSelectedAssetsAction afterAction={() => toggleSelectMode()} />
        </SelectedAssetsToolBar>
      )}
    </>
  );
}
