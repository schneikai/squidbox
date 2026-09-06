export default function getAssetsWithSyncError(assets) {
  return Object.values(assets).filter((asset) => !!asset.syncError && !asset.isDeleted);
}
