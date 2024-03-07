import { useState, useEffect } from 'react';
import { Alert, Button } from 'react-native';

import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import postSchema from '@/utils/posts/postSchema';

export default function EditPostScreen({ route, navigation }) {
  const { postId } = route.params;
  const { posts, updatePost } = usePosts();

  const post = posts[postId];
  const [postData, setPostData] = useState({
    text: post?.text,
    assetRefs: post?.assetRefs,
    postedAt: post?.postedAt,
  });

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => <Button onPress={() => navigation.goBack()} title="Cancel" />,
      headerRight: () => <Button onPress={handleUpdatePost} disabled={!canUpdatePost()} title="Save" />,
    });
  }, [navigation, postData]);

  function handleUpdatePost() {
    try {
      updatePost(postId, postData);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Failed to update post!', error.message);
    }
  }

  function canUpdatePost() {
    try {
      postSchema.validateSync(postData);
      return true;
    } catch (_e) {
      return false;
    }
  }

  return <PostEditor post={postData} onChange={(postData) => setPostData(postData)} />;
}
