import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import PostList from '@/features/post-list/PostList';
import postFilterOptions from '@/features/post-list/actions/filter-posts-action/postFilterOptions';
import postSortOptions from '@/features/post-list/actions/sort-posts-action/postSortOptions';
import postQuery from '@/features/post-list/postQuery';
import usePosts from '@/features/posts-context/usePosts';
import useListControls from '@/hooks/useListControls';
import useScreenPadding from '@/hooks/useScreenPadding';
import { usePagedQuery } from '@/sync/usePagedQuery';

export default function PostsScreen() {
  const navigation = useNavigation();
  const { toggleFavoritePost } = usePosts();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, sortOrder, sort, activeFilter, toggleFilter, searchBar, searchText } = useListControls({
    defaultSort: 'postedAt:desc',
  });

  const scrollHandler = useFloatingBarScrollHandler();

  const query = postQuery({ scope: 'all', sort: sortOrder, filter: activeFilter, search: searchText });
  const { rows, loadMore } = usePagedQuery(query, 20);

  function handleAdd() {
    navigation.navigate('CreatePostModal');
  }

  return (
    <View style={{ flex: 1 }}>
      <FloatingHeader title="Posts" onAdd={handleAdd} />
      <PostList
        listRef={listRef}
        rows={rows}
        loadMore={loadMore}
        contentContainerStyle={{ paddingTop, paddingBottom }}
        onScroll={scrollHandler}
        onDoublePressPost={toggleFavoritePost}
      />
      <FloatingActionsBar
        search={searchBar}
        placeholder="Search posts…"
        sortOrder={sortOrder}
        sortOptions={postSortOptions}
        activeFilter={activeFilter}
        filterOptions={postFilterOptions}
        onSort={sort}
        onFilter={toggleFilter}
      />
    </View>
  );
}
