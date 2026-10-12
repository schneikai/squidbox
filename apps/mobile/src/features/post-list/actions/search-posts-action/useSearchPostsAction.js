import usePostsQuery from '@/features/post-list/posts-query/usePostsQuery';

// The posts query lives in its own context so other screens can open Posts filtered. Plain state:
// it controls the search input (see useSearch).
export default function useSearchPostsAction() {
  const { postsQuery, setPostsQuery } = usePostsQuery();
  return { searchText: postsQuery, setSearchText: setPostsQuery };
}
