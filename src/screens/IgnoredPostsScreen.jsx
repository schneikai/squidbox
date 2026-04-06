import { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';

import EmptyState from '@/components/EmptyState';
import ModalSheet from '@/components/ModalSheet';
import SuperPressable from '@/components/SuperPressable';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import actionButtonStyles from '@/styles/actionButtonStyles';
import usePosts from '@/features/posts-context/usePosts';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import preparePosts from '@/features/post-list/preparePosts';
import { colors } from '@/styles/designTokens';

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
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Ignored Posts"
        scrollY={scrollY}
      />

      {postIds.length === 0 ? (
        <EmptyState
          icon="eye-off"
          title="No ignored posts"
          subtitle="Posts you ignore from the repost queue will appear here."
          style={{ flex: 1, paddingTop: MODAL_HEADER_HEIGHT }}
        />
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
                  <Icon name="eye" color={colors.text} />
                </TouchableOpacity>
              </View>
            </SuperPressable>
          )}
        />
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  actionContainer: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
});
