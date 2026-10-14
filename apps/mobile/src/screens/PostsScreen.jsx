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
import useFilterPostsAction from '@/features/post-list/actions/filter-posts-action/useFilterPostsAction';
import useSearchPostsAction from '@/features/post-list/actions/search-posts-action/useSearchPostsAction';
import useSortPostsAction from '@/features/post-list/actions/sort-posts-action/useSortPostsAction';
import postQuery from '@/features/post-list/postQuery';
import usePostList from '@/features/post-list/usePostList';
import usePosts from '@/features/posts-context/usePosts';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSearchMode from '@/hooks/useSearchMode';
import { usePagedQuery } from '@/sync/usePagedQuery';

export default function PostsScreen() {
  const navigation = useNavigation();
  const { toggleFavoritePost } = usePosts();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = usePostList();
  // A new sort, filter or search starts from the top, at the first page again.
  const restart = () => {
    reset();
    listScrollTop();
  };
  const { sortOrder, sortPosts } = useSortPostsAction({ afterSort: restart });
  const { activeFilter, toggleFilter } = useFilterPostsAction({ afterFilter: restart });

  // The posts query lives in its own context, so other screens can open Posts filtered (e.g. "Show
  // posts" on an asset). The search bar shows it, so it can always be seen and cleared.
  const { searchBar, query: postsSearchText } = useSearchMode(useSearchPostsAction({ afterChange: () => reset() }));

  const { registerScreenOptions } = useFloatingBars();
  const scrollHandler = useFloatingBarScrollHandler();

  const query = postQuery({ scope: 'all', sort: sortOrder, filter: activeFilter, search: postsSearchText });
  const { rows, loadMore, reset } = usePagedQuery(query, [query.descriptor], 20);

  function handleAdd() {
    navigation.navigate('CreatePostModal');
  }

  useEffect(() => {
    registerScreenOptions('posts', {
      sortOrder,
      activeFilter,
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
