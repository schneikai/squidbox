import { useNavigation } from 'expo-router';
import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import PostList from '@/features/post-list/PostList';
import postQuery from '@/features/post-list/postQuery';
import usePosts from '@/features/posts-context/usePosts';
import { space } from '@/styles/designTokens';
import { usePagedQuery } from '@/sync/usePagedQuery';

const ignored = postQuery({ scope: 'ignored', sort: 'updatedAt:desc' });

export default function IgnoredPostsScreen() {
  const navigation = useNavigation();
  const { updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();

  const { rows, count, loadMore } = usePagedQuery(ignored, 20);
  // Stable, so the list re-renders a post only when it changes (PostListItem is memoized).
  const renderPostActions = useCallback(
    (post) => (
      <View style={styles.actionContainer}>
        <Button
          variant="secondary"
          icon="eye"
          onPress={() => updatePost(post.id, { isIgnoredForRepost: false })}
          accessibilityLabel="Restore to the repost queue"
        />
      </View>
    ),
    [updatePost],
  );

  return (
    <ModalSheet>
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Ignored Posts"
      />

      {count === 0 ? (
        <EmptyState
          icon="eye-off"
          title="No ignored posts"
          subtitle="Posts you ignore from the repost queue will appear here."
          style={{ flex: 1, paddingTop: MODAL_HEADER_HEIGHT }}
        />
      ) : (
        <PostList
          rows={rows}
          loadMore={loadMore}
          contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT + SCREEN_PADDING, paddingBottom: bottom + space.lg }}
          renderPostActions={renderPostActions}
        />
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  // Over the post's bottom padding (PostListItem's), like its text.
  actionContainer: {
    position: 'absolute',
    right: space.md,
    bottom: SCREEN_PADDING + space.md,
  },
});
