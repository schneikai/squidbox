/**
 * The pager's current asset: the selected one while it's visible. When it drops out (deleted or
 * missing), the next visible asset in `assetIds` order takes over, falling back to the previous one.
 * An unknown selection starts from the first asset.
 */
export default function getCurrentAssetId({ assetIds, assets, selectedAssetId }) {
  const isVisible = (assetId) => assets[assetId] && !assets[assetId].deletedAt;
  const start = Math.max(0, assetIds.indexOf(selectedAssetId));
  for (let i = start; i < assetIds.length; i++) if (isVisible(assetIds[i])) return assetIds[i];
  for (let i = start - 1; i >= 0; i--) if (isVisible(assetIds[i])) return assetIds[i];
  return null;
}
