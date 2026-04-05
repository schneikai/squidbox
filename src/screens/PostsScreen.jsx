import { useEffect, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';

import SuperPressable from '@/components/SuperPressable';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import useAlbums from '@/features/albums-context/useAlbums';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import useFilterPostsAction from '@/features/post-list/actions/filter-posts-action/useFilterPostsAction';
import useSearchPostsAction from '@/features/post-list/actions/search-posts-action/useSearchPostsAction';
import useSortPostsAction from '@/features/post-list/actions/sort-posts-action/useSortPostsAction';
import preparePosts from '@/features/post-list/preparePosts';
import usePostList from '@/features/post-list/usePostList';
import usePosts from '@/features/posts-context/usePosts';
import useScreenPadding from '@/hooks/useScreenPadding';

export default function PostsScreen() {
  const navigation = useNavigation();
  const { posts, toggleFavoritePost } = usePosts();
  const { albums } = useAlbums();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = usePostList();
  const { sortOrder, sortFunction, sortPosts } = useSortPostsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterPostsAction({ afterFilter: listScrollTop });

  // Posts search uses persisted AppSettings query
  const { searchText: postsSearchText, setSearchText: setPersistentSearch } = useSearchPostsAction();

  const { registerScreenOptions, screenOptionsRef, searchText: globalSearchText, setTabHasActiveOptions } = useFloatingBars();
  const scrollHandler = useFloatingBarScrollHandler();

  // Sync global search bar input to persisted posts query
  useEffect(() => {
    setPersistentSearch(globalSearchText);
  }, [globalSearchText]);

  const postIds = useMemo(
    () =>
      preparePosts({
        posts: Object.values(posts),
        albums,
        sortFn: sortFunction,
        filterFn: matchFilter,
        searchText: postsSearchText,
      }).map((post) => post.id),
    [posts, albums, sortFunction, matchFilter, postsSearchText],
  );

  function handleAdd() {
    navigation.navigate('CreatePostModal');
  }

  useEffect(() => {
    setTabHasActiveOptions('posts', activeFilter.length > 0 || sortOrder !== 'postedAt:desc');
    registerScreenOptions('posts', {
      sortOrder,
      activeFilter,
      onSort: sortPosts,
      onFilter: toggleFilter,
      onAdd: handleAdd,
    });
  }, [sortOrder, activeFilter]);

  return (
    <PostList
      listRef={listRef}
      postIds={postIds}
      contentContainerStyle={{ paddingTop, paddingBottom }}
      onScroll={scrollHandler}
      renderListItem={(post) => (
        <SuperPressable
          onPress={() => navigation.navigate('PostScreen', { postId: post.id })}
          onDoublePress={() => toggleFavoritePost(post)}
          style={{ flex: 1 }}
        >
          <PostListItem {...post} />
        </SuperPressable>
      )}
    />
  );
}
