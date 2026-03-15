import Animated from 'react-native-reanimated';

import usePosts from '@/features/posts-context/usePosts';

export default function PostList({
  postIds: initialPostIds,
  ListHeaderComponent,
  FirstListEntryComponent,
  renderListItem,
  listRef,
  contentContainerStyle,
  onScroll,
}) {
  const { posts } = usePosts();
  const postIds = [...initialPostIds];
  if (FirstListEntryComponent) postIds.unshift('FirstListEntryComponent');

  return (
    <Animated.FlatList
      data={postIds}
      renderItem={({ item: postId, index }) => {
        if (postId === 'FirstListEntryComponent') return FirstListEntryComponent;

        const post = posts[postId];
        if (!post) return null;
        return renderListItem(post);
      }}
      keyExtractor={(postId) => postId}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={ListHeaderComponent ? [0] : undefined}
      contentContainerStyle={contentContainerStyle}
      ref={listRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}

