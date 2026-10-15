import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import readPost from '@/features/post-detail/readPost';
import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import { getDb } from '@/sync/db/client';

// Edits a post, seeded once from what it is when the screen opens; a post deleted meanwhile (e.g. by a
// sync) closes the editor.
export default function EditPostScreen({ route, navigation }) {
  const { postId } = route.params;
  const { updatePost } = usePosts();
  const [post, setPost] = useState(null);

  useEffect(() => {
    readPost(getDb(), postId).then((found) => {
      if (found) return setPost(found);
      Alert.alert('This post was deleted');
      navigation.goBack();
    });
  }, [postId]);

  async function handleUpdatePost(data) {
    try {
      await updatePost(postId, data);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Failed to update post!', error.message);
    }
  }

  if (!post) return null;

  return <PostEditor post={post} navigation={navigation} onSave={handleUpdatePost} />;
}
