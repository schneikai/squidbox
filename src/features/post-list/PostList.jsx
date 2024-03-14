import { FlatList } from 'react-native';

import usePosts from '@/features/posts-context/usePosts';

export default function PostList({
  postIds: initialPostIds,
  ListHeaderComponent,
  FirstListEntryComponent,
  renderListItem,
  listRef,
}) {
  const { posts } = usePosts();
  const postIds = [...initialPostIds];
  if (FirstListEntryComponent) postIds.unshift('FirstListEntryComponent');

  return (
    <FlatList
      data={postIds}
      renderItem={({ item: postId, index }) => {
        if (postId === 'FirstListEntryComponent') return FirstListEntryComponent;

        const post = posts[postId];
        if (!post) return null;
        return renderListItem(post);
      }}
      keyExtractor={(postId) => postId}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={[0]}
      ref={listRef}
    />
  );
}
