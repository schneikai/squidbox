import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
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
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Create Post"
        scrollY={scrollY}
      />

      <PostList
        rows={rows}
        loadMore={loadMore}
        contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT, paddingBottom: bottom + 16 }}
        onScroll={onScroll}
        FirstListEntryComponent={
          <View style={styles.topSection}>
            <Button variant="primary" label="New Post" icon="add" onPress={handleCreateNewPost} />

            {/* Repost section header */}
            <ScreenSectionHeader
              title="Repost something"
              trailing={
                <Button
                  label="Ignored posts"
                  icon="eye-off"
                  onPress={() => navigation.navigate('IgnoredPostsScreen')}
                  colorPalette="muted"
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
      <Button variant="primary" icon="edit" onPress={onRepost} accessibilityLabel="Repost" />
      <Button variant="secondary" icon="clock" onPress={onPostpone} accessibilityLabel="Postpone" />
      <Button variant="secondary" icon="eye-off" onPress={onIgnore} accessibilityLabel="Ignore" />
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
