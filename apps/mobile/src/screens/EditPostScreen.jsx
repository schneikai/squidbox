import { Alert } from 'react-native';

import readPost from '@/features/post-detail/readPost';
import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import useSeedOrClose from '@/hooks/useSeedOrClose';

// Edits a post, seeded once from what it is when the screen opens; a post deleted meanwhile (e.g. by a
// sync) closes the editor.
export default function EditPostScreen({ route, navigation }) {
  const { postId } = route.params;
  const { updatePost } = usePosts();
  const post = useSeedOrClose((db) => readPost(db, postId), postId, 'This post was deleted');

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
