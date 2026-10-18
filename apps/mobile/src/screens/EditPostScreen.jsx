import { Alert } from 'react-native';

import readPost from '@/features/post-detail/readPost';
import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import changedValues from '@/utils/changedValues';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

// Edits a post, seeded once from what it is when the screen opens, and saves what the user changed
// from that seed; a post deleted meanwhile (e.g. by a sync) closes the editor.
export default function EditPostScreen({ route, navigation }) {
  const { postId } = route.params;
  const { updatePost } = usePosts();
  const post = useSeedOrClose((db) => readPost(db, postId), postId, 'This post was deleted');

  async function handleUpdatePost(data) {
    const original = { text: post.text, assetRefs: postAssetsToAssetRefs(post.postAssets), postedAt: post.postedAt };
    const changes = changedValues(original, data);
    try {
      if (Object.keys(changes).length > 0) await updatePost(postId, changes);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Failed to update post!', error.message);
    }
  }

  if (!post) return null;

  return <PostEditor post={post} navigation={navigation} onSave={handleUpdatePost} />;
}
