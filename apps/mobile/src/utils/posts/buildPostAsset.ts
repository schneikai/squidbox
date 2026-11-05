import getNewItemId from '@/utils/getNewItemId';

/** An asset as a post editor holds it: with an id of its own, the post-asset edge's. */
export type PostAsset<A extends { id: string }> = { id: string; asset: A };

export default function buildPostAsset<A extends { id: string }>(asset: A): PostAsset<A> {
  return {
    id: getNewItemId(),
    asset,
  };
}
