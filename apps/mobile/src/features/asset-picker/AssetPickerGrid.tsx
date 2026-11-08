import type { ScrollHandlerProcessed, SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchSortFilterBar from '@/components/floating-bars/SearchSortFilterBar';
import AssetGrid from '@/features/asset-list/AssetGrid';
import assetFilterOptions from '@/features/asset-list/actions/filter-assets-action/assetFilterOptions';
import assetSortOptions from '@/features/asset-list/actions/sort-assets-action/assetSortOptions';
import type { AssetSelection } from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import assetQuery, { type AssetExclude, type AssetFilter } from '@/features/asset-list/assetQuery';
import useListControls from '@/hooks/useListControls';
import { layout } from '@/styles/designTokens';
import type { AssetQueryScope, AssetSort } from '@/sync/assetSql';
import { usePagedQuery } from '@/sync/usePagedQuery';

type AssetPickerGridProps = {
  scope: AssetQueryScope;
  exclude: AssetExclude;
  selection: AssetSelection;
  onScroll: ScrollHandlerProcessed;
  scrollY: SharedValue<number>;
  expandProgress: SharedValue<number>;
};

// The picker's grid of the library or of one album (`scope`, see assetQuery), always selecting, with
// search, sort and filter. `selection` comes from useToggleSelectAssetsAction and outlives the grid.
export default function AssetPickerGrid({
  scope,
  exclude,
  selection,
  onScroll,
  scrollY,
  expandProgress,
}: AssetPickerGridProps) {
  const { bottom } = useSafeAreaInsets();
  const { listRef, sortOrder, sort, activeFilter, toggleFilter, searchBar, searchText } = useListControls<
    AssetSort,
    AssetFilter
  >({
    defaultSort: 'createdAt:desc',
  });

  const query = assetQuery({
    scope,
    sort: sortOrder,
    filter: activeFilter,
    search: searchText,
    exclude,
  });
  const { rows, loadMore } = usePagedQuery(query, 150);

  return (
    <>
      <AssetGrid
        listRef={listRef}
        rows={rows}
        loadMore={loadMore}
        paddingTop={layout.sheetContentTop}
        paddingBottom={bottom + layout.barClearance}
        onScroll={onScroll}
        scrollY={scrollY}
        isSelectMode
        isSheet
        selectedAssetIds={selection.selectedAssetIds}
        isAssetSelected={selection.isAssetSelected}
        selectAssets={selection.selectAssets}
        onPressAsset={(asset) => selection.toggleSelectAsset(asset.id)}
      />
      <SearchSortFilterBar
        search={searchBar}
        expandProgress={expandProgress}
        placeholder="Search notes, tags and contacts…"
        sortOrder={sortOrder}
        sortOptions={assetSortOptions}
        activeFilter={activeFilter}
        filterOptions={assetFilterOptions}
        onSort={sort}
        onFilter={toggleFilter}
        showViewOptions
      />
    </>
  );
}
