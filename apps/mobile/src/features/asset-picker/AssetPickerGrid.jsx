import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import SearchSortFilterBar, { SEARCH_SORT_FILTER_BAR_CLEARANCE } from '@/components/floating-bars/SearchSortFilterBar';
import AssetGrid from '@/features/asset-list/AssetGrid';
import assetFilterOptions from '@/features/asset-list/actions/filter-assets-action/assetFilterOptions';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssetList from '@/features/asset-list/useAssetList';
import useSearch from '@/hooks/useSearch';
import useSearchMode from '@/hooks/useSearchMode';
import { usePagedQuery } from '@/sync/usePagedQuery';

// The picker's grid of the library or of one album (`scope`, see assetQuery), always selecting, with
// search, sort and filter. `selection` comes from useToggleSelectAssetsAction and outlives the grid.
export default function AssetPickerGrid({ scope, excludedAssetIds, selection, onScroll, scrollY, expandProgress }) {
  const { bottom } = useSafeAreaInsets();
  const { listRef, listScrollTop } = useAssetList();
  const { sortOrder, sortAssets } = useSortAssetsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const { searchBar, query: searchText } = useSearchMode(useSearch());

  const query = assetQuery({
    scope,
    sort: sortOrder,
    filter: activeFilter,
    search: searchText,
    exclude: excludedAssetIds,
  });
  const { rows, loadMore } = usePagedQuery(query, 150);

  return (
    <>
      <AssetGrid
        listRef={listRef}
        rows={rows}
        loadMore={loadMore}
        paddingTop={MODAL_HEADER_HEIGHT}
        paddingBottom={bottom + SEARCH_SORT_FILTER_BAR_CLEARANCE}
        onScroll={onScroll}
        scrollY={scrollY}
        isSelectMode
        isSheet
        selectedAssetIds={selection.selectedAssetIds}
        isAssetSelected={selection.isAssetSelected}
        selectAssets={selection.selectAssets}
        onPressAsset={(asset) => selection.toggleSelectAsset(asset.id)}
        sortOrder={sortOrder}
      />
      <SearchSortFilterBar
        search={searchBar}
        expandProgress={expandProgress}
        hasActiveState={activeFilter.length > 0 || sortOrder !== 'createdAt:desc'}
        placeholder="Search notes…"
        sortOrder={sortOrder}
        activeFilter={activeFilter}
        filterOptions={assetFilterOptions}
        onSort={sortAssets}
        onFilter={toggleFilter}
        showViewOptions
      />
    </>
  );
}
