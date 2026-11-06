import AssetList from '@/features/asset-list/AssetList';
import SortableAssetGrid from '@/features/asset-list/SortableAssetGrid';
import useAssetCells from '@/features/asset-list/useAssetCells';

// An asset grid with its cells (which peek in the surface's QuickViewHost): the library, an album
// and the asset picker. In select mode a tap goes to `onPressAsset` and a drag selects (with
// `selectAssets`). `onScroll` gets the grid's scroll events and `scrollY` is the offset it writes,
// which the drag-select then reads. A grid that is a sheet's own screen passes `isSheet`, so a
// drag-select leaves the sheet's swipe down on.
/**
 * @param {object} props
 * @param {object[] | undefined} props.rows
 * @param {number} [props.rowsReadAt]
 * @param {() => void} props.loadMore
 * @param {boolean} [props.isSelectMode]
 * @param {Set<string>} [props.selectedAssetIds]
 * @param {(asset: object) => boolean} [props.isAssetSelected]
 * @param {(asset: { id: string }) => void} props.onPressAsset
 * @param {object} [props.listRef]
 * @param {number} [props.paddingTop]
 * @param {number} [props.paddingBottom]
 * @param {Function} [props.onScroll]
 * @param {object} [props.scrollY]
 * @param {Function} [props.selectAssets]
 * @param {boolean} [props.isSheet]
 * @param {boolean} [props.isSortable]
 * @param {boolean} [props.reorderEnabled]
 * @param {Function} [props.onReorder]
 */
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
  onScroll,
  scrollY,
  selectAssets,
  isSheet = false,
  isSortable = false,
  reorderEnabled = false,
  onReorder,
}) {
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
