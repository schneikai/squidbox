import { router, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import NewPostCard from '@/features/new-post/NewPostCard';
import RepostCard from '@/features/new-post/RepostCard';
import postQuery from '@/features/post-list/postQuery';
import usePosts from '@/features/posts-context/usePosts';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout, space } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { readNewestRepostDate } from '@/sync/postsRepository';
import { usePagedQuery } from '@/sync/usePagedQuery';

const candidates = postQuery({ scope: 'repostCandidates', sort: 'suggestRepostAt:asc' });

/**
 * The New post sheet: a "What's new?" card that opens the editor, then the posts to repost (oldest
 * suggestion first, paged as it scrolls), each a card with Repost, Later and Don't suggest
 * again. With nothing to repost it goes straight to the editor.
 */
export default function NewPostScreen() {
  const navigation = useNavigation();
  const { updatePost } = usePosts();
  const padding = useScreenPadding('sheet');

  const { rows, count, loadMore } = usePagedQuery(candidates, 20);

  // If there's nothing to repost, skip this screen entirely
  useEffect(() => {
    if (count === 0) {
      router.replace('/post-editor');
    }
  }, [count]);

  function handleCreateNewPost() {
    router.navigate('/post-editor');
  }

  function handleRepost(post) {
    router.navigate({ pathname: '/post-editor', params: { rePostId: post.id } });
  }

  async function handleLater(post) {
    const newestDate = await readNewestRepostDate(getDb());
    const from = post.suggestRepostAt || Date.now();
    const suggestRepostAt = Math.round(from + Math.random() * (newestDate - from)); // the server stores whole ms
    await updatePost(post.id, { suggestRepostAt });
  }

  async function handleIgnore(post) {
    await updatePost(post.id, { isIgnoredForRepost: true });
  }

  return (
    <ModalSheet testID="new-post-sheet">
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="New post"
      />

      <FlatList
        data={rows ?? []}
        keyExtractor={keyExtractor}
        ListHeaderComponent={
          <View style={styles.header}>
            <NewPostCard onPress={handleCreateNewPost} />
            <ScreenSectionHeader
              title="Repost something"
              trailing={<Button label="Ignored" size="small" onPress={() => router.navigate('/new-post/ignored')} />}
            />
          </View>
        }
        renderItem={({ item: post }) => (
          <RepostCard
            post={post}
            onOpen={() => router.navigate(`/post/${post.id}`)}
            onRepost={() => handleRepost(post)}
            onLater={() => handleLater(post)}
            onIgnore={() => handleIgnore(post)}
          />
        )}
        // More is asked for only once the first page landed (see PostList).
        onEndReached={rows ? loadMore : undefined}
        onEndReachedThreshold={2}
        contentContainerStyle={[styles.content, padding]}
      />
    </ModalSheet>
  );
}

const keyExtractor = (post) => post.id;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.sideGutter,
    gap: space.lg,
  },
  header: {
    gap: space.lg,
  },
});
