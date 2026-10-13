import SuperPressable from '@/components/SuperPressable';
import AssetList from '@/features/asset-list/AssetList';
import AssetListItem from '@/features/asset-list/AssetListItem';
import SortableAssetGrid from '@/features/asset-list/SortableAssetGrid';

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
      renderListItem={(asset) => (
        <SuperPressable
          onPress={() => onPressAsset(asset)}
          onDoublePress={() => toggleFavoriteAsset(asset)}
          onLongPress={() => (canQuickViewPeek ? openAssetQuickView(asset) : undefined)}
          onLongPressOut={() => closeAssetQuickView()}
          style={{ flex: 1 }}
        >
          <AssetListItem
            asset={asset}
            isSelectMode={isSelectMode}
            isSelected={isAssetSelected(asset.id)}
            showLastPostedAt={sortOrder.includes('lastPostedAt')}
          />
        </SuperPressable>
      )}
    />
  );
}
