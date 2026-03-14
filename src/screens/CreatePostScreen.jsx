import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import SuperPressable from '@/components/SuperPressable';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { SCREEN_PADDING } from '@/constants';
import usePosts from '@/features/posts-context/usePosts';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import preparePosts from '@/features/post-list/preparePosts';

export default function CreatePostScreen({ navigation }) {
  const { posts, updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();

  const postIds = useMemo(
    () =>
      preparePosts({
        posts: Object.values(posts),
        sortFn: (a, b) =>
          (a.suggestRepostAt || a.postedAt || 0) - (b.suggestRepostAt || b.postedAt || 0),
        filterFn: (post) => !post.isIgnoredForRepost && !post.hasBeenReposted,
      }).map((post) => post.id),
    [posts],
  );

  const handleCreateNewPost = () => {
    navigation.navigate('AddEditPostModal');
  };

  const handleRepost = (post) => {
    navigation.navigate('AddEditPostModal', { rePostId: post.id });
  };

  const handlePostpone = async (post) => {
    const allPosts = Object.values(posts);
    const newestDate = allPosts.reduce((max, p) => Math.max(max, p.suggestRepostAt || p.postedAt || 0), 0);
    const from = post.suggestRepostAt || Date.now();
    const suggestRepostAt = from + Math.random() * (newestDate - from);
    await updatePost(post.id, { suggestRepostAt });
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
        contentContainerStyle={{ paddingBottom: bottom + 16 }}
        FirstListEntryComponent={
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Repost something</Text>
            <TouchableOpacity onPress={() => navigation.navigate('IgnoredPostsScreen')} style={styles.ignoredButton}>
              <Ionicons name="eye-off-outline" size={14} color="#8E8E93" />
              <Text style={styles.ignoredButtonLabel}>Ignored posts</Text>
            </TouchableOpacity>
          </View>
        }
        renderListItem={(post) => {
          return (
            <SuperPressable
              onPress={() => navigation.navigate('PostScreen', { postId: post.id })}
              style={{ flex: 1 }}
            >
              <PostListItem {...post} />
              <PostActions
                onRepost={() => handleRepost(post)}
                onPostpone={() => handlePostpone(post)}
                onIgnore={() => handleIgnore(post)}
              />
            </SuperPressable>
          );
        }}
      />
    </>
  );
}

function PostActions({ onRepost, onPostpone, onIgnore }) {
  return (
    <View style={styles.menuContainer}>
      <TouchableOpacity style={[actionButtonStyles.button, styles.primaryButton]} onPress={onRepost}>
        <Ionicons name="create" style={[actionButtonStyles.buttonIcon, styles.primaryButtonIcon]} />
      </TouchableOpacity>
      <TouchableOpacity style={actionButtonStyles.button} onPress={onPostpone}>
        <Ionicons name="time-outline" style={actionButtonStyles.buttonIcon} />
      </TouchableOpacity>
      <TouchableOpacity style={actionButtonStyles.button} onPress={onIgnore}>
        <Ionicons name="eye-off-outline" style={actionButtonStyles.buttonIcon} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  createPostSection: {
    padding: SCREEN_PADDING,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: SCREEN_PADDING,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SCREEN_PADDING,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  ignoredButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  ignoredButtonLabel: {
    fontSize: 13,
    color: '#8E8E93',
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
  menuContainer: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    gap: 6,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonIcon: {
    color: '#FFFFFF',
  },
});
