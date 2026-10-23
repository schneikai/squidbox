import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import SuperPressable from '@/components/SuperPressable';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import postFilterOptions from '@/features/post-list/actions/filter-posts-action/postFilterOptions';
import postSortOptions from '@/features/post-list/actions/sort-posts-action/postSortOptions';
import postQuery from '@/features/post-list/postQuery';
import usePosts from '@/features/posts-context/usePosts';
import useFilter from '@/hooks/useFilter';
import useListScrollTop from '@/hooks/useListScrollTop';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSearch from '@/hooks/useSearch';
import useSearchMode from '@/hooks/useSearchMode';
import useSort from '@/hooks/useSort';
import { usePagedQuery } from '@/sync/usePagedQuery';

export default function PostsScreen() {
  const navigation = useNavigation();
  const { toggleFavoritePost } = usePosts();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = useListScrollTop();
  const { sortOrder, sort } = useSort('postedAt:desc', { afterSort: listScrollTop });
  const { activeFilter, toggleFilter } = useFilter({ afterFilter: listScrollTop });

  const { searchBar, query: postsSearchText } = useSearchMode(useSearch());

  const scrollHandler = useFloatingBarScrollHandler();

  const query = postQuery({ scope: 'all', sort: sortOrder, filter: activeFilter, search: postsSearchText });
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
        renderListItem={(post) => (
          <SuperPressable
            onPress={() => navigation.navigate('PostScreen', { postId: post.id })}
            onDoublePress={() => toggleFavoritePost(post)}
            style={{ flex: 1 }}
          >
            <PostListItem post={post} />
          </SuperPressable>
        )}
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
