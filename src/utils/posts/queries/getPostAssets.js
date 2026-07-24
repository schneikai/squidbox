import arrayOrMapToArray from '@/utils/arrayOrMapToArray';

export default function getPostAssets(post, assets) {
  const assetIds = post.assetRefs.map((ref) => ref.assetId);
  return arrayOrMapToArray(assets).filter((asset) => assetIds.includes(asset.id));
}
