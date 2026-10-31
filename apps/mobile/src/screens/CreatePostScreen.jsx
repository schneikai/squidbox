import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import NewPostCard from '@/features/create-post/NewPostCard';
import RepostCard from '@/features/create-post/RepostCard';
import postQuery from '@/features/post-list/postQuery';
import usePosts from '@/features/posts-context/usePosts';
import useScrollY from '@/hooks/useScrollY';
import { layout, scale } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { readNewestRepostDate } from '@/sync/postsRepository';
import { usePagedQuery } from '@/sync/usePagedQuery';

const candidates = postQuery({ scope: 'repostCandidates', sort: 'suggestRepostAt:asc' });

/**
 * The New post sheet: a "What's new?" card that opens the editor, then the posts to repost (oldest
 * suggestion first, paged as it scrolls), each a card with Repost, Later and Don't suggest
 * again. With nothing to repost it goes straight to the editor.
 */
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
    <ModalSheet>
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="New post"
        scrollY={scrollY}
      />

      <Animated.FlatList
        data={rows ?? []}
        keyExtractor={keyExtractor}
        ListHeaderComponent={
          <View style={styles.header}>
            <NewPostCard onPress={handleCreateNewPost} />
            <ScreenSectionHeader
              title="Repost something"
              trailing={
                <Button label="Ignored" size="small" onPress={() => navigation.navigate('IgnoredPostsScreen')} />
              }
            />
          </View>
        }
        renderItem={({ item: post }) => (
          <RepostCard
            post={post}
            onOpen={() => navigation.navigate('PostScreen', { postId: post.id })}
            onRepost={() => handleRepost(post)}
            onLater={() => handleLater(post)}
            onIgnore={() => handleIgnore(post)}
          />
        )}
        // More is asked for only once the first page landed (see PostList).
        onEndReached={rows ? loadMore : undefined}
        onEndReachedThreshold={2}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingTop: MODAL_HEADER_HEIGHT, paddingBottom: bottom + 16 }]}
      />
    </ModalSheet>
  );
}

const keyExtractor = (post) => post.id;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.sideGutter,
    gap: scale(14),
  },
  header: {
    gap: scale(14),
  },
});
