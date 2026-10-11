/**
 * Resolves which assets the detail pager shows and which one is current.
 *
 * Missing or deleted assets drop out of the pager. When the selected asset drops out, the next
 * remaining asset in the original order becomes current, falling back to the previous one.
 */
export default function getAssetPagerState({ assetIds, assets, selectedAssetId }) {
  const isVisible = (assetId) => !!assets[assetId] && !assets[assetId].deletedAt;
  const visibleAssetIds = assetIds.filter(isVisible);

  return {
    visibleAssetIds,
    currentAssetId: findNearestVisibleAssetId(assetIds, selectedAssetId, isVisible) ?? visibleAssetIds[0] ?? null,
  };
}

function findNearestVisibleAssetId(assetIds, selectedAssetId, isVisible) {
  const selectedIndex = assetIds.indexOf(selectedAssetId);
  if (selectedIndex < 0) return null;

  return assetIds.slice(selectedIndex).find(isVisible) ?? assetIds.slice(0, selectedIndex).findLast(isVisible);
}
