import postAsCopyPosts from './postAsCopyPosts';
import sameMentions from './sameMentions';

import sameOrder from '@/lib/sameOrder';
import type { PostCopyWithAssets } from '@/sync/queries/readPostCopies';

/**
 * Whether a channel copy says what the post says: as many posts as the post and its thread, each
 * with the same text, mentions and assets in order (what Send now or Send all stores of an untouched
 * card).
 */
export default function isCopyOfPost(
  copy: Pick<PostCopyWithAssets, 'posts'>,
  post: Parameters<typeof postAsCopyPosts>[0],
): boolean {
  const posts = postAsCopyPosts(post);
  return (
    copy.posts.length === posts.length &&
    copy.posts.every((part, index) => {
      const other = posts[index]!;
      return (
        part.text === other.text &&
        sameMentions(part.mentions, other.mentions) &&
        sameOrder(part.assetIds, other.assetIds)
      );
    })
  );
}
