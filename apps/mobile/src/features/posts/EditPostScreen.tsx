import { useLocalSearchParams } from 'expo-router';

import PostEditor, { type EditedPost } from '@/features/posts/PostEditor';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import usePosts from '@/providers/posts/usePosts';
import readPost from '@/sync/queries/readPost';
import changedValues from '@/utils/changedValues';

// Edits a post and its thread (the post as read carries its `threadPosts`), seeded once from what it
// is when the screen opens, and saves what the user changed from that seed; a post deleted meanwhile
// (e.g. by a sync) closes the editor.
export default function EditPostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { updatePost } = usePosts();
  const post = useSeedOrClose((db) => readPost(db, postId), postId, 'This post was deleted');

  async function handleUpdatePost(data: EditedPost, seed: EditedPost) {
    await updatePost(postId, changedValues(seed, data), seed);
  }

  if (!post) return null;

  return <PostEditor kind="edit" ideas="post" post={post} onSave={handleUpdatePost} />;
}
