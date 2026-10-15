import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import readPost from '@/features/post-detail/readPost';
import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import { getDb } from '@/sync/db/client';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';
import postSchema from '@/utils/posts/postSchema';

// Edits a post, seeded once from what it is when the screen opens.
export default function EditPostScreen({ route, navigation }) {
  const { postId } = route.params;
  const { updatePost } = usePosts();
  const [post, setPost] = useState(null);

  useEffect(() => {
    readPost(getDb(), postId).then(setPost);
  }, [postId]);

  const data = post && { text: post.text, assetRefs: postAssetsToAssetRefs(post.postAssets), postedAt: post.postedAt };

  async function handleUpdatePost() {
    try {
      await updatePost(postId, data);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Failed to update post!', error.message);
    }
  }

  function canUpdatePost() {
    try {
      postSchema.validateSync(data);
      return true;
    } catch (_e) {
      return false;
    }
  }

  if (!post) return null;

  return (
    <PostEditor
      post={post}
      onChange={setPost}
      navigation={navigation}
      onSave={handleUpdatePost}
      canSave={canUpdatePost()}
      title="Edit Post"
    />
  );
}
