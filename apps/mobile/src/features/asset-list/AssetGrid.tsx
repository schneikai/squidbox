import AssetList from '@/features/asset-list/AssetList';
import SortableAssetGrid, { type SortableAssetGridProps } from '@/features/asset-list/SortableAssetGrid';
import useAssetCells, { type UseAssetCellsOptions } from '@/features/asset-list/useAssetCells';
import type { AssetRow } from '@/sync/db/schema';

type AssetGridProps = Pick<
  SortableAssetGridProps,
  | 'rows'
  | 'rowsReadAt'
  | 'loadMore'
  | 'listRef'
  | 'paddingTop'
  | 'paddingBottom'
  | 'header'
  | 'onScroll'
  | 'scrollY'
  | 'selectedAssetIds'
  | 'selectAssets'
  | 'reorderEnabled'
  | 'onReorder'
> & {
  isSelectMode?: boolean;
  isAssetSelected?: UseAssetCellsOptions['isAssetSelected'];
  onPressAsset: (asset: AssetRow) => void;
  isSheet?: boolean;
  isSortable?: boolean;
};

// An asset grid with its cells (which peek in the surface's QuickViewHost): the library, an album
// and the asset picker. In select mode a tap goes to `onPressAsset` and a drag selects (with
// `selectAssets`). `onScroll` gets the grid's scroll events and `scrollY` is the offset it writes,
// which the drag-select then reads. A grid that is a sheet's own screen passes `isSheet`, so a
// drag-select leaves the sheet's swipe down on. `header` scrolls with the cells, above them.
export default function AssetGrid({
  rows,
  rowsReadAt,
  loadMore,
  isSelectMode = false,
  selectedAssetIds,
  isAssetSelected,
  onPressAsset,
  listRef,
  paddingTop,
  paddingBottom,
  header,
  onScroll,
  scrollY,
  selectAssets,
  isSheet = false,
  isSortable = false,
  reorderEnabled = false,
  onReorder,
}: AssetGridProps) {
  // Regular albums can be reordered by dragging; every other grid uses the virtualized list.
  const Grid = isSortable ? SortableAssetGrid : AssetList;
  const { renderCell, peek, endPeek } = useAssetCells({
    onPress: onPressAsset,
    isSelectMode,
    isAssetSelected,
    // Long-press lifts to drag when reordering (and drag-selects in select mode): the grid peeks then.
    canPeek: !reorderEnabled,
  });

  return (
    <Grid
      listRef={listRef}
      rows={rows}
      rowsReadAt={rowsReadAt}
      loadMore={loadMore}
      paddingTop={paddingTop}
      paddingBottom={paddingBottom}
      header={header}
      onScroll={onScroll}
      scrollY={scrollY}
      dragSelectEnabled={isSelectMode}
      dragSelectLocksSwipeBack={!isSheet}
      reorderEnabled={reorderEnabled}
      onReorder={onReorder}
      onPeek={peek}
      onPeekEnd={endPeek}
      selectedAssetIds={selectedAssetIds}
      selectAssets={selectAssets}
      renderListItem={renderCell}
    />
  );
}
