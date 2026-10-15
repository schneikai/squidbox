import AssetList from '@/features/asset-list/AssetList';
import SortableAssetGrid from '@/features/asset-list/SortableAssetGrid';
import useAssetCells from '@/features/asset-list/useAssetCells';

export default function AlbumAssetsView({
  rows,
  count,
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
  const { renderCell, quickViewModal } = useAssetCells({
    onPress: onPressAsset,
    isSelectMode,
    isAssetSelected,
    showLastPostedAt: sortOrder.includes('lastPostedAt'),
    // Long-press drags when reordering (and drag-selects in select mode), so it can't also peek.
    canPeek: !reorderEnabled,
  });

  return (
    <>
      {quickViewModal}
      <Grid
        listRef={listRef}
        rows={rows}
        count={count}
        loadMore={loadMore}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        dragSelectEnabled={isSelectMode}
        reorderEnabled={reorderEnabled}
        onReorder={onReorder}
        selectedAssetIds={selectedAssetIds}
        selectAssets={selectAssets}
        renderListItem={renderCell}
      />
    </>
  );
}
