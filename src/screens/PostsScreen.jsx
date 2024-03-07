import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HeaderActions from '@/components/HeaderActions';
import SuperPressable from '@/components/SuperPressable';
import ScreenHeaderWithSearch from '@/components/screen-header/ScreenHeaderWithSearch';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import AddPostAction from '@/features/post-list/actions/add-post-action/AddPostAction';
import FilterPostsAction from '@/features/post-list/actions/filter-posts-action/FilterPostsAction';
import useFilterPostsAction from '@/features/post-list/actions/filter-posts-action/useFilterPostsAction';
import SearchPostsAction from '@/features/post-list/actions/search-posts-action/SearchPostsAction';
import useSearchPostsAction from '@/features/post-list/actions/search-posts-action/useSearchPostsAction';
import SortPostsAction from '@/features/post-list/actions/sort-posts-action/SortPostsAction';
import useSortPostsAction from '@/features/post-list/actions/sort-posts-action/useSortPostsAction';
import preparePosts from '@/features/post-list/preparePosts';
import usePostList from '@/features/post-list/usePostList';
import usePosts from '@/features/posts-context/usePosts';

export default function PostsScreen({ navigation }) {
  const { posts, toggleFavoritePost } = usePosts();
  const insets = useSafeAreaInsets();
  const [postIds, setPostIds] = useState();

  const { listRef, listScrollTop } = usePostList();
  const { sortOrder, sortFunction, sortPosts } = useSortPostsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterPostsAction({ afterFilter: listScrollTop });
  const { isSearchBarVisible, toggleSearchBar, searchText, setSearchText } = useSearchPostsAction();

  useEffect(() => {
    const postIds = preparePosts({
      posts: Object.values(posts),
      sortFn: sortFunction,
      filterFn: matchFilter,
      searchText,
    }).map((post) => post.id);
    // We show the suggested postables at the top of the list.
    setPostIds(['SuggestedPostables', ...postIds]);
  }, [posts, sortOrder, activeFilter, searchText]);

  return (
    <>
      <PostList
        listRef={listRef}
        postIds={postIds}
        renderListItem={(post) => {
          return (
            <SuperPressable
              onPress={() => navigation.navigate('PostScreen', { postId: post.id })}
              onDoublePress={() => toggleFavoritePost(post)}
              style={{ flex: 1 }}
            >
              <PostListItem {...post} />
            </SuperPressable>
          );
        }}
        ListHeaderComponent={
          <>
            <ScreenHeaderWithSearch
              label="Posts"
              insets={insets}
              isSearchBarVisible={isSearchBarVisible}
              searchText={searchText}
              setSearchText={setSearchText}
              toggleSearchBar={toggleSearchBar}
            >
              <HeaderActions>
                <AddPostAction />
                <SearchPostsAction isSearchBarVisible={isSearchBarVisible} onPress={toggleSearchBar} />
                <SortPostsAction sortOrder={sortOrder} onPress={sortPosts} />
                <FilterPostsAction activeFilter={activeFilter} onPress={toggleFilter} />
              </HeaderActions>
            </ScreenHeaderWithSearch>
          </>
        }
      />
    </>
  );
}
