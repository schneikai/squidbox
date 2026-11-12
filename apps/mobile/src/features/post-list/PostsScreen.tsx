import { router } from 'expo-router';
import { View } from 'react-native';

import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import PostList from '@/features/post-list/PostList';
import postSortOptions from '@/features/post-list/actions/sort-posts-action/postSortOptions';
import postQuery, { type PostSort } from '@/features/post-list/postQuery';
import useListControls from '@/hooks/useListControls';
import useScreenPadding from '@/hooks/useScreenPadding';
import { usePagedQuery } from '@/sync/usePagedQuery';

export default function PostsScreen() {
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, sortOrder, sort, searchBar, searchText } = useListControls<PostSort>({
    defaultSort: 'postedAt:desc',
  });

  const { onScroll: scrollHandler, scrollY } = useFloatingBarScrollHandler();

  const query = postQuery({ scope: 'all', sort: sortOrder, search: searchText });
  const { rows, loadMore } = usePagedQuery(query, 20);

  function handleAdd() {
    router.navigate('/new-post');
  }

  return (
    <View testID="posts-screen" style={{ flex: 1 }}>
      <FloatingHeader title="Posts" scrollY={scrollY} onAdd={handleAdd} />
      <PostList
        listRef={listRef}
        rows={rows}
        loadMore={loadMore}
        contentContainerStyle={{ paddingTop, paddingBottom }}
        onScroll={scrollHandler}
      />
      <FloatingActionsBar
        search={searchBar}
        placeholder="Search posts…"
        sortOrder={sortOrder}
        sortOptions={postSortOptions}
        onSort={sort}
      />
    </View>
  );
}
