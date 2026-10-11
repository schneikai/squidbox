import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import SuperPressable from '@/components/SuperPressable';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
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
import useSearchMode from '@/hooks/useSearchMode';

export default function PostsScreen() {
  const navigation = useNavigation();
  const { posts, toggleFavoritePost } = usePosts();
  const { albums } = useAlbums();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = usePostList();
  const { sortOrder, sortFunction, sortPosts } = useSortPostsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterPostsAction({ afterFilter: listScrollTop });

  // The posts query lives in AppSettings, so other screens can open Posts filtered (e.g. "Show
  // posts" on an asset). The search bar shows it, so it can always be seen and cleared.
  const { searchBar, query: postsSearchText } = useSearchMode(useSearchPostsAction());

  const { registerScreenOptions } = useFloatingBars();
  const scrollHandler = useFloatingBarScrollHandler();

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
      <FloatingActionsBar search={searchBar} placeholder="Search posts…" hasActiveState={hasActiveOptions} />
    </View>
  );
}
