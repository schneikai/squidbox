import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import SuperPressable from '@/components/SuperPressable';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import actionButtonStyles from '@/styles/actionButtonStyles';
import usePosts from '@/features/posts-context/usePosts';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import preparePosts from '@/features/post-list/preparePosts';
import { colors, scale, spacing } from '@/styles/designTokens';

export default function IgnoredPostsScreen({ navigation }) {
  const { posts, updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const postIds = useMemo(
    () =>
      preparePosts({
        posts: Object.values(posts),
        sortFn: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
        filterFn: (post) => !!post.isIgnoredForRepost,
      }).map((post) => post.id),
    [posts],
  );

  async function handleRestore(post) {
    await updatePost(post.id, { isIgnoredForRepost: false });
  }

  return (
    <View style={styles.container}>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Ignored Posts"
        scrollY={scrollY}
      />

      {postIds.length === 0 ? (
        <View style={[styles.emptyState, { paddingTop: MODAL_HEADER_HEIGHT }]}>
          <Ionicons name="eye-off-outline" size={scale(44)} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No ignored posts</Text>
          <Text style={styles.emptySubtitle}>Posts you ignore from the repost queue will appear here.</Text>
        </View>
      ) : (
        <PostList
          postIds={postIds}
          contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT, paddingBottom: bottom + 16 }}
          onScroll={onScroll}
          renderListItem={(post) => (
            <SuperPressable
              onPress={() => navigation.navigate('PostScreen', { postId: post.id })}
              style={{ flex: 1 }}
            >
              <PostListItem {...post} />
              <View style={styles.actionContainer}>
                <TouchableOpacity style={actionButtonStyles.button} onPress={() => handleRestore(post)}>
                  <Ionicons name="eye-outline" style={actionButtonStyles.buttonIcon} />
                </TouchableOpacity>
              </View>
            </SuperPressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground[0],
  },
  actionContainer: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.floatingBarSide * 2,
    gap: 12,
    paddingBottom: 60,
  },
  emptyTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: scale(14),
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
