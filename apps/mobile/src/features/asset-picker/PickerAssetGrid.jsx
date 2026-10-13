import { useMemo } from 'react';

import PickerHeader from '@/components/PickerHeader';
import AssetList from '@/features/asset-list/AssetList';
import FilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/FilterAssetsAction';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import SortAssetsAction from '@/features/asset-list/actions/sort-assets-action/SortAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetCells from '@/features/asset-list/useAssetCells';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useAssets from '@/features/assets-context/useAssets';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';

// The picker's sortable, filterable grid of the whole library, or of one album.
export default function PickerAssetGrid({ album, label }) {
  const { assets } = useAssets();
  const { toggleSelectAsset, isAssetSelected } = useAssetPicker();
  const { listRef, listScrollTop } = useAssetList();
  const { sortOrder, sortFunction, sortAssets } = useSortAssetsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const { renderCell, quickViewModal } = useAssetCells({
    onPress: (asset) => toggleSelectAsset(asset.id),
    isAssetSelected,
    showLastPostedAt: sortOrder.includes('lastPostedAt'),
  });

  const assetIds = useMemo(
    () =>
      prepareAssets({
        assets: album ? getAlbumAssets(album, assets) : Object.values(assets),
        sortFn: sortFunction,
        filterFn: matchFilter,
      }).map((asset) => asset.id),
    [album, assets, sortFunction, matchFilter],
  );

  return (
    <>
      {quickViewModal}
      <AssetList
        listRef={listRef}
        assetIds={assetIds}
        renderListItem={renderCell}
        ListHeaderComponent={
          <PickerHeader label={label}>
            <SortAssetsAction sortOrder={sortOrder} onPress={sortAssets} />
            <FilterAssetsAction activeFilter={activeFilter} onPress={toggleFilter} />
          </PickerHeader>
        }
      />
    </>
  );
}
