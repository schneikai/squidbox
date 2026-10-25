import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import IconButton from '@/components/IconButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import TextButton from '@/components/TextButton';
import { SCREEN_PADDING } from '@/constants';
import PostList from '@/features/post-list/PostList';
import postQuery from '@/features/post-list/postQuery';
import usePosts from '@/features/posts-context/usePosts';
import useScrollY from '@/hooks/useScrollY';
import { getDb } from '@/sync/db/client';
import { readNewestRepostDate } from '@/sync/postsRepository';
import { usePagedQuery } from '@/sync/usePagedQuery';

const candidates = postQuery({ scope: 'repostCandidates', sort: 'suggestRepostAt:asc' });

export default function CreatePostScreen({ navigation }) {
  const { updatePost } = usePosts();
  const { bottom } = useSafeAreaInsets();
  const { scrollY, onScroll } = useScrollY();

  const { rows, count, loadMore } = usePagedQuery(candidates, 20);

  // If there's nothing to repost, skip this screen entirely
  useEffect(() => {
    if (count === 0) {
      navigation.replace('AddEditPostModal');
    }
  }, [count]);

  function handleCreateNewPost() {
    navigation.navigate('AddEditPostModal');
  }

  function handleRepost(post) {
    navigation.navigate('AddEditPostModal', { rePostId: post.id });
  }

  async function handlePostpone(post) {
    const newestDate = await readNewestRepostDate(getDb());
    const from = post.suggestRepostAt || Date.now();
    const suggestRepostAt = Math.round(from + Math.random() * (newestDate - from)); // the server stores whole ms
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
            <PrimaryButton label="New Post" icon="add" onPress={handleCreateNewPost} />

            {/* Repost section header */}
            <ScreenSectionHeader
              title="Repost something"
              rightSlot={
                <TextButton
                  label="Ignored posts"
                  icon="eye-off"
                  onPress={() => navigation.navigate('IgnoredPostsScreen')}
                  tone="muted"
                  size="small"
                />
              }
            />
          </View>
        }
        renderPostActions={(post) => (
          <PostActions
            onRepost={() => handleRepost(post)}
            onPostpone={() => handlePostpone(post)}
            onIgnore={() => handleIgnore(post)}
          />
        )}
      />
    </ModalSheet>
  );
}

function PostActions({ onRepost, onPostpone, onIgnore }) {
  return (
    <View style={styles.menuContainer}>
      <IconButton variant="primary" icon="edit" onPress={onRepost} accessibilityLabel="Repost" />
      <IconButton variant="tinted" icon="clock" onPress={onPostpone} accessibilityLabel="Postpone" />
      <IconButton variant="tinted" icon="eye-off" onPress={onIgnore} accessibilityLabel="Ignore" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Posts pad only below themselves (PostListItem), so the room above the first is here.
  topSection: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 20,
    paddingBottom: SCREEN_PADDING,
    gap: 8,
  },

  // Over the post's bottom padding (PostListItem's), like its text.
  menuContainer: {
    position: 'absolute',
    right: 12,
    bottom: SCREEN_PADDING + 12,
    flexDirection: 'row',
    gap: 6,
  },
});
