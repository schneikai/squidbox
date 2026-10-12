/** The pager's assets: `assetIds` without missing or deleted assets, in order. */
export default function getVisibleAssetIds(assetIds, assets) {
  return assetIds.filter((assetId) => assets[assetId] && !assets[assetId].deletedAt);
}
