import type { PostCopyPost } from '@squidbox/shared';

import type { PostRow } from '@/sync/db/schema';

/**
 * A post and its thread (or a composer's cards) as a channel copy's posts, in order: each with its
 * text, mentions and assets in order. The inverse of the Send to channels `copyAsPost`.
 */
export default function postAsCopyPosts<A extends { id: string }>(
  parts: readonly (Pick<PostRow, 'text' | 'mentions'> & { postAssets: readonly { asset: A }[] })[],
): (PostCopyPost & { assets: A[] })[] {
  return parts.map(({ text, mentions, postAssets }) => {
    const assets = postAssets.map((postAsset) => postAsset.asset);
    return { text, mentions, assetIds: assets.map((asset) => asset.id), assets };
  });
}
