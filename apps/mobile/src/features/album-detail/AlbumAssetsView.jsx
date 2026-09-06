import SuperPressable from '@/components/SuperPressable';
import AssetListItem from '@/features/asset-list/AssetListItem';
import SortableAssetGrid from '@/features/asset-list/SortableAssetGrid';

export default function AlbumAssetsView({
  assetIds,
  isSelectMode,
  selectedAssetIds,
  onPressAsset,
  toggleFavoriteAsset,
  openAssetQuickView,
  closeAssetQuickView,
  sortOrder,
  listRef,
  paddingTop,
  paddingBottom,
  selectAssets,
  reorderEnabled,
  onReorder,
}) {
  // Long-press has three mutually exclusive behaviors: drag-select (select mode),
  // drag-reorder (reorder enabled), or the quick-view peek (everything else).
  const canQuickViewPeek = !isSelectMode && !reorderEnabled;

  return (
    <SortableAssetGrid
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
            isSelected={selectedAssetIds.includes(asset.id)}
            showLastPostedAt={sortOrder.includes('lastPostedAt')}
          />
        </SuperPressable>
      )}
    />
  );
}
