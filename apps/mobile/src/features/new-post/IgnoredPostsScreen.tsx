import { useNavigation } from 'expo-router';
import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import PostList from '@/features/post-list/PostList';
import postQuery from '@/features/post-list/postQuery';
import usePosts from '@/features/posts-context/usePosts';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout, space } from '@/styles/designTokens';
import type { PostRow } from '@/sync/db/schema';
import { usePagedQuery } from '@/sync/usePagedQuery';

const ignored = postQuery({ scope: 'ignored', sort: 'updatedAt:desc' });

export default function IgnoredPostsScreen() {
  const navigation = useNavigation();
  const { updatePost } = usePosts();
  const padding = useScreenPadding('sheet');

  const { rows, count, loadMore } = usePagedQuery(ignored, 20);
  // Stable, so the list re-renders a post only when it changes (PostListItem is memoized).
  const renderPostActions = useCallback(
    (post: Pick<PostRow, 'id'>) => (
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
          style={{ flex: 1, paddingTop: layout.sheetContentTop }}
        />
      ) : (
        // JS component: its destructured props read as required until post-list converts.
        <PostList
          rows={rows}
          loadMore={loadMore}
          contentContainerStyle={padding}
          renderPostActions={renderPostActions}
          ListHeaderComponent={undefined}
          FirstListEntryComponent={undefined}
          listRef={undefined}
          onScroll={undefined}
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
