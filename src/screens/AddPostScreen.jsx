import { useState } from 'react';
import { Alert } from 'react-native';

import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import getTimestamp from '@/utils/date-time/getTimestamp';
import getNewItemId from '@/utils/getNewItemId';
import postSchema from '@/utils/posts/postSchema';

export default function AddPostScreen({ route, navigation }) {
  const { rePostId, assetIds, text: prefilledText } = route.params ?? {};
  const { posts, addPost, updatePost } = usePosts();
  let rePost = null;
  const initialPostData = {
    text: prefilledText ?? '',
    assetRefs: [],
    postedAt: getTimestamp(),
  };

  if (rePostId) {
    rePost = posts[rePostId];
    if (rePost) {
      initialPostData.text = rePost.text;
      initialPostData.assetRefs = assetIdsToAssetRefs(rePost.assetRefs.map((assetRef) => assetRef.assetId));
    }
  } else if (assetIds) {
    initialPostData.assetRefs = assetIdsToAssetRefs(assetIds);
  }

  const [postData, setPostData] = useState(initialPostData);

  async function handleAddPost() {
    const addPostData = { ...postData };
    if (rePost) addPostData.rePostId = rePost.id;

    try {
      await addPost(addPostData);
      if (rePost) {
        await updatePost(rePost.id, { hasBeenReposted: true });
      }
      navigation.popToTop();
    } catch (error) {
      Alert.alert('Failed to create post!', error.message);
    }
  }

  function canAddPost() {
    try {
      postSchema.validateSync(postData);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function assetIdsToAssetRefs(assetIds) {
    return assetIds.map((assetId) => ({ id: getNewItemId(), assetId }));
  }

  return (
    <PostEditor
      post={postData}
      onChange={(postData) => setPostData(postData)}
      navigation={navigation}
      onSave={handleAddPost}
      canSave={canAddPost()}
    />
  );
}
