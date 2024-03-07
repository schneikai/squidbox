export default function getUnsyncedAssets(assets) {
  return Object.values(assets).filter((asset) => !asset.isSynced && !asset.isDeleted && !asset.syncError);
}
