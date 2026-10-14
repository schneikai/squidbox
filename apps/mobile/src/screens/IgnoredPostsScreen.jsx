import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '@/components/EmptyState';
import Icon from '@/components/Icon';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import SuperPressable from '@/components/SuperPressable';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import postQuery from '@/features/post-list/postQuery';
import usePosts from '@/features/posts-context/usePosts';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors } from '@/styles/designTokens';
import { usePagedQuery } from '@/sync/usePagedQuery';

const ignored = postQuery({ scope: 'ignored', sort: 'updatedAt:desc' });

export default function IgnoredPostsScreen({ navigation }) {
  const { updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

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
          contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT, paddingBottom: bottom + 16 }}
          onScroll={onScroll}
          renderListItem={(post) => (
            <SuperPressable onPress={() => navigation.navigate('PostScreen', { postId: post.id })} style={{ flex: 1 }}>
              <PostListItem post={post} />
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
