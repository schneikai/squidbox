import type { PostAsset } from './buildPostAsset';
import buildPostAssets from './buildPostAssets';

/** The same assets as new post-asset refs, for a post that gets them as its own (a copy, a repost). */
export default function freshPostAssets<A extends { id: string }>(postAssets: readonly { asset: A }[]): PostAsset<A>[] {
  return buildPostAssets(postAssets.map((postAsset) => postAsset.asset));
}
