import { useLocalSearchParams } from 'expo-router';

import PostEditor from '@/features/posts/PostEditor';
import type { EditedPost } from '@/features/posts/draft/postDraftReducer';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import usePosts from '@/providers/posts/usePosts';
import readPost from '@/sync/queries/readPost';
import changedValues from '@/utils/changedValues';

// Edits a post, its thread and its other channels (the post as read carries its `threadPosts` and
// `channelPosts`), seeded once from what it is when the screen opens, showing the channel saved as
// `channelPostId` when given (the one the post screen showed), and saves what the user changed from
// that seed; a post deleted meanwhile (e.g. by a sync) closes the editor.
export default function EditPostScreen() {
  const { postId, channelPostId } = useLocalSearchParams<{ postId: string; channelPostId?: string }>();
  const { updatePost } = usePosts();
  const post = useSeedOrClose((db) => readPost(db, postId), postId, 'This post was deleted');

  async function handleUpdatePost(data: EditedPost, seed: EditedPost) {
    await updatePost(postId, changedValues(seed, data), seed);
  }

  if (!post) return null;

  return (
    <PostEditor kind="edit" ideas="post" post={post} selectedChannelPostId={channelPostId} onSave={handleUpdatePost} />
  );
}
