import PickerHeader from '@/components/PickerHeader';
import AssetList from '@/features/asset-list/AssetList';
import FilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/FilterAssetsAction';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import SortAssetsAction from '@/features/asset-list/actions/sort-assets-action/SortAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssetCells from '@/features/asset-list/useAssetCells';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import { usePagedQuery } from '@/sync/usePagedQuery';
import getAlbumAssetScope from '@/utils/albums/getAlbumAssetScope';

// The picker's sortable, filterable grid of the whole library, or of one album.
export default function PickerAssetGrid({ album, label }) {
  const { toggleSelectAsset, isAssetSelected } = useAssetPicker();
  const { listRef, listScrollTop } = useAssetList();
  const { sortOrder, sortAssets } = useSortAssetsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const { renderCell, quickViewModal } = useAssetCells({
    onPress: (asset) => toggleSelectAsset(asset.id),
    isSelectMode: true, // the picker always selects
    isAssetSelected,
    showLastPostedAt: sortOrder.includes('lastPostedAt'),
  });

  const query = assetQuery({
    scope: album ? getAlbumAssetScope(album) : 'library',
    sort: sortOrder,
    filter: activeFilter,
  });
  const { rows, loadMore } = usePagedQuery(query, 150);

  return (
    <>
      {quickViewModal}
      <AssetList
        listRef={listRef}
        rows={rows}
        loadMore={loadMore}
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
