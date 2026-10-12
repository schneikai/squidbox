/**
 * The pager's current asset: the selected one while it's visible. When it drops out (deleted or
 * missing), the next visible asset in `assetIds` order takes over, falling back to the previous
 * one, then to the first visible asset. Walks outward from the selection, so a swipe costs O(1).
 */
export default function getCurrentAssetId({ assetIds, assets, selectedAssetId, visibleAssetIds }) {
  const isVisible = (assetId) => assets[assetId] && !assets[assetId].deletedAt;
  const selectedIndex = assetIds.indexOf(selectedAssetId);
  if (selectedIndex >= 0) {
    for (let i = selectedIndex; i < assetIds.length; i++) if (isVisible(assetIds[i])) return assetIds[i];
    for (let i = selectedIndex - 1; i >= 0; i--) if (isVisible(assetIds[i])) return assetIds[i];
  }
  return visibleAssetIds[0] ?? null;
}
