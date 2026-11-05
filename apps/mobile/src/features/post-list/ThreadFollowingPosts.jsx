import usePost from './usePost';

import ThreadParts from '@/components/ThreadParts';
import PostView from '@/features/posts/PostView';

/**
 * The following posts of a thread unfolded in the posts list, each as a card like the first post's
 * without the Posted row, joined by the thread's line. Read live once mounted; nothing until then.
 */
export default function ThreadFollowingPosts({ postId }) {
  const post = usePost(postId);

  if (!post) return null;

  return (
    <ThreadParts parts={post.threadPosts} renderPart={(part) => <PostView post={part} isPostedAtShown={false} />} />
  );
}
