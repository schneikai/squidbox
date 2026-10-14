/** The pager's assets: `assetIds` without the ones that dropped out (deleted or missing), in order. */
export default function getVisibleAssetIds(assetIds, droppedIds) {
  return assetIds.filter((assetId) => !droppedIds.has(assetId));
}
