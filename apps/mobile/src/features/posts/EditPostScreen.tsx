import { useLocalSearchParams } from 'expo-router';

import linkTypedHandles from '@/features/post-mentions/linkTypedHandles';
import readContactsByHandle from '@/features/post-mentions/readContactsByHandle';
import PostEditor from '@/features/posts/PostEditor';
import draftFromPost from '@/features/posts/draft/draftFromPost';
import postData, { type EditedPost } from '@/features/posts/draft/postData';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import usePosts from '@/providers/posts/usePosts';
import type { SyncDb } from '@/sync/db/types';
import readPost from '@/sync/queries/readPost';
import changedValues from '@/utils/changedValues';

// Edits a post and its thread (the post as read carries its `threadPosts`), seeded once from what it
// is when the screen opens: the editor opens on it with each typed @handle that means one contact as
// that contact's chip (linkTypedHandles), so Save stays off until the user changes something, and
// saves what differs from the post as stored, the chips included. A post deleted meanwhile (e.g. by a
// sync) closes the editor.
export default function EditPostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { updatePost } = usePosts();
  const seed = useSeedOrClose((db) => readSeed(db, postId), postId, 'This post was deleted');

  async function handleUpdatePost(data: EditedPost) {
    if (!seed) return;
    const saved = postData(draftFromPost(seed.stored), seed.stored.postedAt);
    await updatePost(postId, changedValues(saved, data), saved);
  }

  if (!seed) return null;

  return <PostEditor kind="edit" ideas="post" post={seed.opened} onSave={handleUpdatePost} />;
}

// The post as stored, and as the editor opens it (its thread too).
async function readSeed(db: SyncDb, postId: string) {
  const [stored, ofHandle] = await Promise.all([readPost(db, postId), readContactsByHandle(db)]);
  if (!stored) return null;
  const opened = {
    ...linkTypedHandles(stored, ofHandle),
    threadPosts: stored.threadPosts.map((part) => linkTypedHandles(part, ofHandle)),
  };
  return { stored, opened };
}
