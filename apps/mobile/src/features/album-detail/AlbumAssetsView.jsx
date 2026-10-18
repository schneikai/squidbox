import AssetList from '@/features/asset-list/AssetList';
import SortableAssetGrid from '@/features/asset-list/SortableAssetGrid';
import useAssetCells from '@/features/asset-list/useAssetCells';

export default function AlbumAssetsView({
  rows,
  rowsReadAt,
  loadMore,
  isSelectMode,
  selectedAssetIds,
  isAssetSelected,
  onPressAsset,
  sortOrder,
  listRef,
  paddingTop,
  paddingBottom,
  selectAssets,
  isSortable,
  reorderEnabled,
  onReorder,
}) {
  // Regular albums can be reordered by dragging; smart albums (Favorites, Deleted) have no stored
  // order and use the virtualized list.
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
