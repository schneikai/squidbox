import type { AssetRef } from '@/sync/postThreads';
import type { PostAsset } from '@/utils/posts/buildPostAsset';

export default function postAssetsToAssetRefs(postAssets: readonly PostAsset<{ id: string }>[]): AssetRef[] {
  return postAssets.map((postAsset) => ({ id: postAsset.id, assetId: postAsset.asset.id }));
}
