import { FlatList } from 'react-native';

import usePosts from '@/features/posts-context/usePosts';
import SuggestedPostables from '@/features/suggested-postables/SuggestedPostables';

export default function PostList({ postIds, ListHeaderComponent, renderListItem, listRef }) {
  const { posts } = usePosts();

  return (
    <FlatList
      data={postIds}
      renderItem={({ item }) => {
        if (item === 'SuggestedPostables') return <SuggestedPostables />;

        const post = posts[item];
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
