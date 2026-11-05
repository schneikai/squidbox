import usePost from './usePost';

import ThreadParts from '@/components/ThreadParts';
import ThreadPost from '@/features/posts/ThreadPost';

/**
 * The following posts of a thread unfolded in the posts list, each as a row card (ThreadPost, like
 * the post screen's; a tap on it opens the thread like the rest of the item), joined by the thread's line. Read live once mounted; nothing until then.
 */
export default function ThreadFollowingPosts({ postId }) {
  const post = usePost(postId);

  if (!post) return null;

  return <ThreadParts parts={post.threadPosts} renderPart={(part) => <ThreadPost post={part} />} />;
}
