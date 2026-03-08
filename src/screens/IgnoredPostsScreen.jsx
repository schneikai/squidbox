import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TouchableOpacity } from 'react-native';
import SuperPressable from '@/components/SuperPressable';
import headerActionStyles from '@/styles/headerActionStyles';
import usePosts from '@/features/posts-context/usePosts';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import preparePosts from '@/features/post-list/preparePosts';

export default function IgnoredPostsScreen({ navigation }) {
  const { posts, updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();
  const [postIds, setPostIds] = useState([]);

  useEffect(() => {
    const preparedPosts = preparePosts({
      posts: Object.values(posts),
      sortFn: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
      filterFn: (post) => !!post.isIgnoredForRepost,
    });
    setPostIds(preparedPosts.map(post => post.id));
  }, [posts]);

  const handleRestore = async (post) => {
    await updatePost(post.id, { isIgnoredForRepost: false });
  };

  return (
    <PostList
      postIds={postIds}
      contentContainerStyle={{ paddingBottom: bottom + 16 }}
      renderListItem={(post) => (
        <SuperPressable
          onPress={() => navigation.navigate('PostScreen', { postId: post.id })}
          style={{ flex: 1 }}
        >
          <PostListItem {...post} />
          <View style={styles.actionContainer}>
            <TouchableOpacity style={headerActionStyles.button} onPress={() => handleRestore(post)}>
              <Ionicons name="eye-outline" style={headerActionStyles.buttonIcon} />
            </TouchableOpacity>
          </View>
        </SuperPressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  actionContainer: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
});
