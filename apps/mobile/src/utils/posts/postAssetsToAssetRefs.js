export default function postAssetsToAssetRefs(postAssets) {
  return postAssets.map((postAsset) => ({ id: postAsset.id, assetId: postAsset.asset.id }));
}
