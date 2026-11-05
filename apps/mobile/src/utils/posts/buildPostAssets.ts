import buildPostAsset, { type PostAsset } from './buildPostAsset';

export default function buildPostAssets<A extends { id: string }>(assets: readonly A[]): PostAsset<A>[] {
  return assets.map((asset) => buildPostAsset(asset));
}
