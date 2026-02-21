import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Menu, MenuOptions, MenuTrigger, renderers } from 'react-native-popup-menu';
import SuperPressable from '@/components/SuperPressable';
import TextMenuOption from '@/components/popup-menu-options/TextMenuOption';
import headerActionStyles from '@/styles/headerActionStyles';
import usePosts from '@/features/posts-context/usePosts';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import preparePosts from '@/features/post-list/preparePosts';

export default function CreatePostScreen({ navigation }) {
  const { posts, updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();
  const [postIds, setPostIds] = useState([]);

  useEffect(() => {
    const preparedPosts = preparePosts({
      posts: Object.values(posts),
      sortFn: (a, b) =>
        (a.suggestRepostAt || a.postedAt || 0) - (b.suggestRepostAt || b.postedAt || 0),
      filterFn: (post) => !post.isIgnoredForRepost && !post.hasBeenReposted,
    });
    setPostIds(preparedPosts.map(post => post.id));
  }, [posts]);

  const handleCreateNewPost = () => {
    navigation.navigate('AddEditPostModal');
  };

  const handleRepost = (post) => {
    navigation.navigate('AddEditPostModal', { rePostId: post.id });
  };

  const handlePostpone = async (post) => {
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
        contentContainerStyle={{ paddingBottom: bottom + 16 }}
        FirstListEntryComponent={<Text style={styles.sectionTitle}>Repost something</Text>}
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
      <TouchableOpacity style={[headerActionStyles.button, styles.primaryButton]} onPress={onRepost}>
        <Ionicons name="create" style={[headerActionStyles.buttonIcon, styles.primaryButtonIcon]} />
      </TouchableOpacity>
      <Menu renderer={renderers.Popover} rendererProps={{ preferredPlacement: 'top' }}>
        <MenuTrigger customStyles={{ triggerWrapper: headerActionStyles.button }}>
          <Ionicons name="ellipsis-horizontal" style={headerActionStyles.buttonIcon} />
        </MenuTrigger>
        <MenuOptions customStyles={menuStyles}>
          <TextMenuOption label="Postpone" onPress={onPostpone} />
          <TextMenuOption label="Ignore" onPress={onIgnore} isLast />
        </MenuOptions>
      </Menu>
    </View>
  );
}

const menuStyles = {
  optionsContainer: {
    backgroundColor: 'rgba(220, 220, 220, 0.96)',
    borderRadius: 10,
    shadowColor: 'transparent',
    width: 160,
  },
};

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
