import React, { useState, useEffect, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import SuperPressable from '@/components/SuperPressable';
import usePosts from '@/features/posts-context/usePosts';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import preparePosts from '@/features/post-list/preparePosts';
import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import getLatestPostDate from '@/utils/posts/getLatestPostDate';

export default function CreatePostScreen({ navigation }) {
  const { posts, updatePost } = usePosts();
  const { albums } = useAlbums();
  const { assets } = useAssets();
  const [postIds, setPostIds] = useState([]);

  // Memoize the latest dates for all posts to avoid recalculating during sorts
  const postDates = useMemo(() => {
    const dates = new Map();
    Object.values(posts).forEach(post => {
      dates.set(post.id, getLatestPostDate(post, assets, albums));
    });
    return dates;
  }, [posts, assets, albums]);

  // Memoize the sorting function
  const sortFn = useMemo(() => {
    return (a, b) => postDates.get(a.id) - postDates.get(b.id);
  }, [postDates]);

  useEffect(() => {
    const preparedPosts = preparePosts({
      posts: Object.values(posts),
      sortFn,
      filterFn: (post) => !post.isIgnoredForRepost && !post.hasBeenReposted,
    });
    setPostIds(preparedPosts.map(post => post.id));
  }, [posts, sortFn]);

  const handleCreateNewPost = () => {
    navigation.replace('AddEditPostModal');
  };

  const handleRepost = (post) => {
    navigation.navigate('AddEditPostModal', { rePostId: post.id });
  };

  const handlePostpone = async (post) => {
    // Randomly postpone between 1-12 months from now
    const monthsToPostpone = Math.floor(Math.random() * 12) + 1;
    const suggestRepostAt = new Date();
    suggestRepostAt.setMonth(suggestRepostAt.getMonth() + monthsToPostpone);
    await updatePost(post.id, { suggestRepostAt: suggestRepostAt.getTime() });
  };

  const handleIgnore = async (post) => {
    await updatePost(post.id, { isIgnoredForRepost: true });
  };

  return (
    <>
      <View style={styles.createPostSection}>
        <TouchableOpacity
          onPress={handleCreateNewPost}
          style={styles.createPostButton}
        >
          <Ionicons name="create" size={24} color="#FFFFFF" />
          <Text style={styles.createPostText}>Create New Post</Text>
        </TouchableOpacity>
      </View>

      <PostList
        postIds={postIds}
        FirstListEntryComponent={<Text style={styles.sectionTitle}>Repost something</Text>}
        renderListItem={(post) => {
          return (
            <SuperPressable
              onPress={() => navigation.navigate('PostScreen', { postId: post.id })}
              onDoublePress={() => toggleFavoritePost(post)}
              style={{ flex: 1 }}
            >
              <PostListItem {...post} />
              <View style={styles.postActionButtonContainer}>
                <TouchableOpacity
                  onPress={() => handleRepost(post)}
                  style={styles.postActionButton}
                >
                  <Ionicons name="repeat" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handlePostpone(post)}
                  style={{ ...styles.postActionButton, backgroundColor: '#999999' }}
                >
                  <Ionicons name="arrow-down" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleIgnore(post)}
                  style={{ ...styles.postActionButton, backgroundColor: '#999999' }}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </SuperPressable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  createPostSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
  },
  createPostText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  repostSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    padding: 16,
    paddingBottom: 8,
  },
  listContent: {
    paddingBottom: 16,
  },
  postCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  postContent: {
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  postDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  postDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  repostButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#8E8E93',
  },
  postActionButtonContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
  },
  postActionButton: {
    backgroundColor: '#007AFF',
    width: 30,
    height: 30,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
