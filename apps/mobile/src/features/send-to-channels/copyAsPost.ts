import type { PostCopyWithAssets } from '@/sync/queries/readPostCopies';
import buildPostAssets from '@/utils/posts/buildPostAssets';

/**
 * A copy's posts as a post and its thread: the first post, its following ones as `threadPosts`
 * (no ids: a copy's posts have none), each post's assets as its postAssets. Null for a copy without
 * posts.
 */
export default function copyAsPost(copy: Pick<PostCopyWithAssets, 'posts'>) {
  const [first, ...following] = copy.posts.map(({ text, mentions, assets }) => ({
    text,
    mentions,
    postAssets: buildPostAssets(assets),
  }));
  if (!first) return null;
  return { ...first, threadPosts: following.map((part) => ({ ...part, id: null })) };
}
