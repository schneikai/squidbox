import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '@/components/EmptyState';
import IconButton from '@/components/IconButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import SuperPressable from '@/components/SuperPressable';
import { SCREEN_PADDING } from '@/constants';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import postQuery from '@/features/post-list/postQuery';
import usePosts from '@/features/posts-context/usePosts';
import useScrollY from '@/hooks/useScrollY';
import { usePagedQuery } from '@/sync/usePagedQuery';

const ignored = postQuery({ scope: 'ignored', sort: 'updatedAt:desc' });

export default function IgnoredPostsScreen({ navigation }) {
  const { updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollY();

  const { rows, count, loadMore } = usePagedQuery(ignored, 20);

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
          contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT + SCREEN_PADDING, paddingBottom: bottom + 16 }}
          onScroll={onScroll}
          renderListItem={(post) => (
            <SuperPressable onPress={() => navigation.navigate('PostScreen', { postId: post.id })} style={{ flex: 1 }}>
              <PostListItem post={post} />
              <View style={styles.actionContainer}>
                <IconButton
                  variant="tinted"
                  icon="eye"
                  onPress={() => handleRestore(post)}
                  accessibilityLabel="Restore to the repost queue"
                />
              </View>
            </SuperPressable>
          )}
        />
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  // Over the post's bottom padding (PostListItem's), like its text.
  actionContainer: {
    position: 'absolute',
    right: 12,
    bottom: SCREEN_PADDING + 12,
  },
});
