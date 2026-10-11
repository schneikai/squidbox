import useAppSettings from '@/features/app-settings/useAppSettings';

// The posts query lives in AppSettings so other screens can open Posts filtered. Plain state: it
// controls the search input (see useSearch).
export default function useSearchPostsAction() {
  const { postsQuery, setPostsQuery } = useAppSettings();
  return { searchText: postsQuery, setSearchText: setPostsQuery };
}
