import { useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';

import ModalSheet from '@/components/ModalSheet';
import SuperPressable from '@/components/SuperPressable';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import RandomSuggestionsModal from '@/features/post-random-suggestions/RandomSuggestionsModal';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { SCREEN_PADDING } from '@/constants';
import usePosts from '@/features/posts-context/usePosts';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import preparePosts from '@/features/post-list/preparePosts';
import { colors, radii, scale, typography } from '@/styles/designTokens';

export default function CreatePostScreen({ navigation }) {
  const { posts, updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const [showRandomSuggestions, setShowRandomSuggestions] = useState(false);

  const recentPostTexts = useMemo(
    () =>
      Object.values(posts ?? {})
        .filter((p) => p.text?.trim())
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => p.text.trim()),
    [posts],
  );

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

  function handleSuggestionConfirm(asset, text) {
    const params = {};
    if (asset) params.assetIds = [asset.id];
    if (text) params.text = text;
    navigation.navigate('AddEditPostModal', params);
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
    <ModalSheet>
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
            {/* New post + AI suggestions row */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.newPostButton, styles.actionRowFlex]} onPress={handleCreateNewPost} activeOpacity={0.85}>
                <Icon name="add" size={scale(22)} color={colors.textInverse} />
                <Text style={styles.newPostText}>New Post</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aiButton} onPress={() => setShowRandomSuggestions(true)} activeOpacity={0.85}>
                <Icon name="sparkles" size={scale(22)} color={colors.textInverse} />
              </TouchableOpacity>
            </View>

            {/* Repost section header */}
            <ScreenSectionHeader
              title="Repost something"
              rightSlot={
                <TouchableOpacity onPress={() => navigation.navigate('IgnoredPostsScreen')} style={styles.ignoredButton}>
                  <Icon name="eye-off" size={scale(14)} color={colors.textSecondary} />
                  <Text style={styles.ignoredButtonLabel}>Ignored posts</Text>
                </TouchableOpacity>
              }
            />
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
      <RandomSuggestionsModal
        visible={showRandomSuggestions}
        onClose={() => setShowRandomSuggestions(false)}
        onConfirm={handleSuggestionConfirm}
        recentPostTexts={recentPostTexts}
      />
    </ModalSheet>
  );
}

function PostActions({ onRepost, onPostpone, onIgnore }) {
  return (
    <View style={styles.menuContainer}>
      <TouchableOpacity style={[actionButtonStyles.button, styles.primaryButton]} onPress={onRepost}>
        <Icon name="edit" color={colors.textInverse} />
      </TouchableOpacity>
      <TouchableOpacity style={actionButtonStyles.button} onPress={onPostpone}>
        <Icon name="clock" color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity style={actionButtonStyles.button} onPress={onIgnore}>
        <Icon name="eye-off" color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topSection: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 20,
    gap: 8,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionRowFlex: {
    flex: 1,
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
  aiButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.card,
    paddingHorizontal: 18,
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
});
