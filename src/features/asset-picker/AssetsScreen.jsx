import { useEffect, useState } from 'react';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import HeaderActions from '@/components/HeaderActions';
import SuperPressable from '@/components/SuperPressable';
import ScreenHeader from '@/components/screen-header/ScreenHeader';
import AssetList from '@/features/asset-list/AssetList';
import AssetListItem from '@/features/asset-list/AssetListItem';
import FilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/FilterAssetsAction';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import SortAssetsAction from '@/features/asset-list/actions/sort-assets-action/SortAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useAssets from '@/features/assets-context/useAssets';

export default function AssetsScreen() {
  const { assets, toggleFavoriteAsset } = useAssets();
  const { toggleSelectAsset, isAssetSelected } = useAssetPicker();
  const [assetIds, setAssetIds] = useState();
  const { listRef, listScrollTop } = useAssetList();
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

  return (
    <>
      <AssetQuickViewModal asset={quickViewAsset} isVisible={!!quickViewAsset} />
      <AssetList
        listRef={listRef}
        assetIds={assetIds}
        renderListItem={(asset) => (
          <SuperPressable
            onPress={() => toggleSelectAsset(asset)}
            onDoublePress={() => toggleFavoriteAsset(asset)}
            onLongPress={() => openAssetQuickView(asset)}
            onLongPressOut={() => closeAssetQuickView()}
            style={{ flex: 1 }}
          >
            <AssetListItem
              asset={asset}
              isSelected={isAssetSelected(asset)}
              showLastPostedAt={sortOrder.includes('lastPostedAt')}
            />
          </SuperPressable>
        )}
        ListHeaderComponent={
          <ScreenHeader label="Assets">
            <HeaderActions>
              <SortAssetsAction sortOrder={sortOrder} onPress={sortAssets} />
              <FilterAssetsAction activeFilter={activeFilter} onPress={toggleFilter} />
            </HeaderActions>
          </ScreenHeader>
        }
      />
    </>
  );
}
