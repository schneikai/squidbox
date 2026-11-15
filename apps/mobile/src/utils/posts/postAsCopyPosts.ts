import type { PostDetailRow } from '@/sync/queries/readPost';
import type { PostCopyPostWithAssets } from '@/sync/queries/readPostCopies';

/**
 * A post and its thread as a channel copy's posts: the post, then its following posts in order, each
 * with its text, mentions and assets in order. The inverse of the Send to channels `copyAsPost`.
 */
export default function postAsCopyPosts(
  post: Pick<PostDetailRow, 'text' | 'mentions' | 'postAssets' | 'threadPosts'>,
): PostCopyPostWithAssets[] {
  return [post, ...post.threadPosts].map(({ text, mentions, postAssets }) => {
    const assets = postAssets.map((postAsset) => postAsset.asset);
    return { text, mentions, assetIds: assets.map((asset) => asset.id), assets };
  });
}
