import usePostsQuery from '@/features/post-list/posts-query/usePostsQuery';

// The posts query lives in its own context so other screens can open Posts filtered. Plain state:
// it controls the search input (see useSearch); `afterChange` runs on every change made here.
export default function useSearchPostsAction({ afterChange } = {}) {
  const { postsQuery, setPostsQuery } = usePostsQuery();

  function setSearchText(text) {
    setPostsQuery(text);
    if (afterChange) afterChange();
  }

  return { searchText: postsQuery, setSearchText };
}
