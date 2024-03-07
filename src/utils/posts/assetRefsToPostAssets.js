export default function assetRefsToPostAssets(assetRefs, assetsArrayOrMap) {
  return assetRefs
    .map((assetRef) => {
      const asset = findAsset(assetRef.assetId, assetsArrayOrMap);
      if (!asset) return null;
      return {
        id: assetRef.id,
        asset,
      };
    })
    .filter(Boolean);
}

function findAsset(assetId, assetsArrayOrMap) {
  if (Array.isArray(assetsArrayOrMap)) {
    return assetsArrayOrMap.find((a) => a.id === assetId);
  }
  return assetsArrayOrMap[assetId];
}
