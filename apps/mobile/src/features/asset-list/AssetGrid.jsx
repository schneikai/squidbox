import AssetList from '@/features/asset-list/AssetList';
import SortableAssetGrid from '@/features/asset-list/SortableAssetGrid';
import useAssetCells from '@/features/asset-list/useAssetCells';

// An asset grid with its cells and quick view: the library, an album and the asset picker. In select
// mode a tap goes to `onPressAsset` and a drag selects (with `selectAssets`).
export default function AssetGrid({
  rows,
  rowsReadAt,
  loadMore,
  isSelectMode = false,
  selectedAssetIds,
  isAssetSelected,
  onPressAsset,
  sortOrder,
  listRef,
  paddingTop,
  paddingBottom,
  onScroll,
  scrollY,
  selectAssets,
  isSortable = false,
  reorderEnabled = false,
  onReorder,
}) {
  // Regular albums can be reordered by dragging; every other grid uses the virtualized list.
  const Grid = isSortable ? SortableAssetGrid : AssetList;
  const { renderCell, quickViewModal, peek, endPeek } = useAssetCells({
    onPress: onPressAsset,
    isSelectMode,
    isAssetSelected,
    showLastPostedAt: sortOrder.includes('lastPostedAt'),
    // Long-press lifts to drag when reordering (and drag-selects in select mode): the grid peeks then.
    canPeek: !reorderEnabled,
  });

  return (
    <>
      {quickViewModal}
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
        reorderEnabled={reorderEnabled}
        onReorder={onReorder}
        onPeek={peek}
        onPeekEnd={endPeek}
        selectedAssetIds={selectedAssetIds}
        selectAssets={selectAssets}
        renderListItem={renderCell}
      />
    </>
  );
}
