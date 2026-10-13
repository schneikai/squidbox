import AssetList from '@/features/asset-list/AssetList';
import SortableAssetGrid from '@/features/asset-list/SortableAssetGrid';
import useAssetCells from '@/features/asset-list/useAssetCells';

export default function AlbumAssetsView({
  assetIds,
  isSelectMode,
  selectedAssetIds,
  isAssetSelected,
  onPressAsset,
  toggleFavoriteAsset,
  openAssetQuickView,
  closeAssetQuickView,
  sortOrder,
  listRef,
  paddingTop,
  paddingBottom,
  selectAssets,
  canReorder,
  reorderEnabled,
  onReorder,
}) {
  // Long-press has three mutually exclusive behaviors: drag-select (select mode),
  // drag-reorder (reorder enabled), or the quick-view peek (everything else).
  const canQuickViewPeek = !isSelectMode && !reorderEnabled;
  // Albums that can't be reordered (smart albums, which can hold thousands) use the virtualized list.
  const Grid = canReorder ? SortableAssetGrid : AssetList;
  const renderCell = useAssetCells({
    isSelectMode,
    isAssetSelected,
    showLastPostedAt: sortOrder.includes('lastPostedAt'),
    onPress: onPressAsset,
    onDoublePress: toggleFavoriteAsset,
    onLongPress: (asset) => canQuickViewPeek && openAssetQuickView(asset),
    onLongPressOut: closeAssetQuickView,
  });

  return (
    <Grid
      listRef={listRef}
      assetIds={assetIds}
      contentContainerStyle={{ paddingTop, paddingBottom }}
      dragSelectEnabled={isSelectMode}
      reorderEnabled={reorderEnabled}
      onReorder={onReorder}
      selectedAssetIds={selectedAssetIds}
      selectAssets={selectAssets}
      renderListItem={renderCell}
    />
  );
}
