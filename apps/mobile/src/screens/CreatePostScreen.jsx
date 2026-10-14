import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SuperPressable from '@/components/SuperPressable';
import { SCREEN_PADDING } from '@/constants';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import postQuery from '@/features/post-list/postQuery';
import RandomSuggestionsModal from '@/features/post-random-suggestions/RandomSuggestionsModal';
import usePosts from '@/features/posts-context/usePosts';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, radii, scale, typography } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import { readNewestRepostDate, readPostTexts } from '@/sync/postsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import { usePagedQuery } from '@/sync/usePagedQuery';

const candidates = postQuery({ scope: 'repostCandidates', sort: 'suggestRepostAt:asc' });
const NO_TEXTS = [];

export default function CreatePostScreen({ navigation }) {
  const { updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const [showRandomSuggestions, setShowRandomSuggestions] = useState(false);

  const recentPostTexts = useLiveQuery(readPostTexts, [schema.posts]) ?? NO_TEXTS;
  const { rows, count, loadMore } = usePagedQuery(candidates, [], 20);

  // If there's nothing to repost, skip this screen entirely
  useEffect(() => {
    if (count === 0) {
      navigation.replace('AddEditPostModal');
    }
  }, [count]);

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
    const newestDate = await readNewestRepostDate(getDb());
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
        rows={rows}
        loadMore={loadMore}
        contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT, paddingBottom: bottom + 16 }}
        onScroll={onScroll}
        FirstListEntryComponent={
          <View style={styles.topSection}>
            {/* New post + AI suggestions row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.newPostButton, styles.actionRowFlex]}
                onPress={handleCreateNewPost}
                activeOpacity={0.85}
              >
                <Icon name="add" size={scale(22)} color={colors.textInverse} />
                <Text style={styles.newPostText}>New Post</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiButton}
                onPress={() => setShowRandomSuggestions(true)}
                activeOpacity={0.85}
              >
                <Icon name="sparkles" size={scale(22)} color={colors.textInverse} />
              </TouchableOpacity>
            </View>

            {/* Repost section header */}
            <ScreenSectionHeader
              title="Repost something"
              rightSlot={
                <TouchableOpacity
                  onPress={() => navigation.navigate('IgnoredPostsScreen')}
                  style={styles.ignoredButton}
                >
                  <Icon name="eye-off" size={scale(14)} color={colors.textSecondary} />
                  <Text style={styles.ignoredButtonLabel}>Ignored posts</Text>
                </TouchableOpacity>
              }
            />
          </View>
        }
        renderListItem={(post) => {
          return (
            <SuperPressable onPress={() => navigation.navigate('PostScreen', { postId: post.id })} style={{ flex: 1 }}>
              <PostListItem post={post} />
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
