import { useMemo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import SuperPressable from '@/components/SuperPressable';
import GradientPillButton from '@/components/GradientPillButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { SCREEN_PADDING } from '@/constants';
import usePosts from '@/features/posts-context/usePosts';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import preparePosts from '@/features/post-list/preparePosts';
import { colors, radii, scale, spacing, typography } from '@/styles/designTokens';

export default function CreatePostScreen({ navigation }) {
  const { posts, updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

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

  // If there's nothing to repost, skip this screen entirely
  useEffect(() => {
    if (postIds.length === 0) {
      navigation.replace('AddEditPostModal');
    }
  }, [postIds.length]);

  function handleCreateNewPost() {
    navigation.navigate('AddEditPostModal');
  }

  function handleRepost(post) {
    navigation.navigate('AddEditPostModal', { rePostId: post.id });
  }

  async function handlePostpone(post) {
    const allPosts = Object.values(posts);
    const newestDate = allPosts.reduce((max, p) => Math.max(max, p.suggestRepostAt || p.postedAt || 0), 0);
    const from = post.suggestRepostAt || Date.now();
    const suggestRepostAt = from + Math.random() * (newestDate - from);
    await updatePost(post.id, { suggestRepostAt });
  }

  async function handleIgnore(post) {
    await updatePost(post.id, { isIgnoredForRepost: true });
  }

  return (
    <View style={styles.container}>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Create Post"
        scrollY={scrollY}
      />

      <PostList
        postIds={postIds}
        contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT, paddingBottom: bottom + 16 }}
        onScroll={onScroll}
        FirstListEntryComponent={
          <View style={styles.topSection}>
            {/* New post card */}
            <TouchableOpacity style={styles.newPostButton} onPress={handleCreateNewPost} activeOpacity={0.85}>
              <Ionicons name="add" size={scale(22)} color={colors.textInverse} />
              <Text style={styles.newPostText}>New Post</Text>
            </TouchableOpacity>

            {/* Repost section header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Repost something</Text>
              <TouchableOpacity onPress={() => navigation.navigate('IgnoredPostsScreen')} style={styles.ignoredButton}>
                <Ionicons name="eye-off-outline" size={scale(14)} color={colors.textSecondary} />
                <Text style={styles.ignoredButtonLabel}>Ignored posts</Text>
              </TouchableOpacity>
            </View>
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
    </View>
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
    backgroundColor: colors.appBackground[0],
  },

  topSection: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 8,
    gap: 8,
  },

  newPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: radii.card,
    paddingVertical: 16,
  },
  newPostText: {
    color: colors.textInverse,
    fontSize: typography.base,
    fontWeight: '600',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  ignoredButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  ignoredButtonLabel: {
    fontSize: scale(13),
    color: colors.textSecondary,
  },

  menuContainer: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    gap: 6,
  },
  primaryButton: {
    backgroundColor: colors.accent,
  },
  primaryButtonIcon: {
    color: colors.textInverse,
  },
});
