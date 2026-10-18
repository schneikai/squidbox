import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { View } from 'react-native';

import SuperPressable from '@/components/SuperPressable';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import postFilterOptions from '@/features/post-list/actions/filter-posts-action/postFilterOptions';
import useFilterPostsAction from '@/features/post-list/actions/filter-posts-action/useFilterPostsAction';
import postSortOptions from '@/features/post-list/actions/sort-posts-action/postSortOptions';
import useSortPostsAction from '@/features/post-list/actions/sort-posts-action/useSortPostsAction';
import postQuery from '@/features/post-list/postQuery';
import usePostList from '@/features/post-list/usePostList';
import usePosts from '@/features/posts-context/usePosts';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSearch from '@/hooks/useSearch';
import useSearchMode from '@/hooks/useSearchMode';
import { usePagedQuery } from '@/sync/usePagedQuery';

export default function PostsScreen() {
  const navigation = useNavigation();
  const { toggleFavoritePost } = usePosts();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = usePostList();
  const { sortOrder, sortPosts } = useSortPostsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter } = useFilterPostsAction({ afterFilter: listScrollTop });

  const { searchBar, query: postsSearchText } = useSearchMode(useSearch());

  const { registerScreenOptions } = useFloatingBars();
  const scrollHandler = useFloatingBarScrollHandler();

  const query = postQuery({ scope: 'all', sort: sortOrder, filter: activeFilter, search: postsSearchText });
  const { rows, loadMore } = usePagedQuery(query, 20);

  function handleAdd() {
    navigation.navigate('CreatePostModal');
  }

  useEffect(() => {
    registerScreenOptions('posts', {
      sortOrder,
      activeFilter,
      sortOptions: postSortOptions,
      filterOptions: postFilterOptions,
      onSort: sortPosts,
      onFilter: toggleFilter,
    });
  }, [sortOrder, activeFilter]);

  const hasActiveOptions = activeFilter.length > 0 || sortOrder !== 'postedAt:desc';

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
      <FloatingActionsBar search={searchBar} placeholder="Search posts…" hasActiveState={hasActiveOptions} />
    </View>
  );
}
