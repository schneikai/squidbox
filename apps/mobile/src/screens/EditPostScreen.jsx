import { useState } from 'react';
import { Alert } from 'react-native';

import usePost from '@/features/post-detail/usePost';
import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';
import postSchema from '@/utils/posts/postSchema';

export default function EditPostScreen({ route, navigation }) {
  const { postId } = route.params;
  const { updatePost } = usePosts();
  const post = usePost(postId);
  const [postData, setPostData] = useState(null);

  if (!post) return null;

  const data = postData ?? {
    text: post.text,
    assetRefs: postAssetsToAssetRefs(post.postAssets),
    postedAt: post.postedAt,
  };

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

  return (
    <PostEditor
      post={post}
      onChange={setPostData}
      navigation={navigation}
      onSave={handleUpdatePost}
      canSave={canUpdatePost()}
      title="Edit Post"
    />
  );
}
