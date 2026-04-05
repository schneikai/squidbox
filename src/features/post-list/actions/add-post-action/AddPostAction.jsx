import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Pressable } from 'react-native';
import { useMemo } from 'react';

import actionButtonStyles from '@/styles/actionButtonStyles';
import usePosts from '@/features/posts-context/usePosts';
import preparePosts from '@/features/post-list/preparePosts';

export default function AddPostAction() {
  const navigation = useNavigation();
  const { posts } = usePosts();

  const hasRepostablePosts = useMemo(() => {
    const repostable = preparePosts({
      posts: Object.values(posts),
      sortFn: () => 0,
      filterFn: (post) => !post.isIgnoredForRepost && !post.hasBeenReposted,
    });
    return repostable.length > 0;
  }, [posts]);

  function handlePress() {
    if (hasRepostablePosts) {
      navigation.navigate('CreatePostModal');
    } else {
      navigation.navigate('AddEditPostModal');
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[actionButtonStyles.button, { marginRight: 20 }]}
    >
      <Ionicons name="add" style={actionButtonStyles.buttonIcon} />
    </Pressable>
  );
}
