import SuperPressable from '@/components/SuperPressable';
import AssetList from '@/features/asset-list/AssetList';
import AssetListItem from '@/features/asset-list/AssetListItem';

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
}) {
  return (
    <AssetList
      listRef={listRef}
      assetIds={assetIds}
      contentContainerStyle={{ paddingTop, paddingBottom }}
      dragSelectEnabled={isSelectMode}
      selectedAssetIds={selectedAssetIds}
      selectAssets={selectAssets}
      renderListItem={(asset) => (
        <SuperPressable
          onPress={() => onPressAsset(asset)}
          onDoublePress={() => toggleFavoriteAsset(asset)}
          onLongPress={() => (isSelectMode ? undefined : openAssetQuickView(asset))}
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
