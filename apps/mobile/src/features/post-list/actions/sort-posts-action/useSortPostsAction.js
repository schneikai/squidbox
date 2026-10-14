import useSort from '@/hooks/useSort';

export default function useSortPostsAction({ afterSort } = {}) {
  const { sortOrder, sort } = useSort('postedAt:desc', { afterSort });
  return { sortOrder, sortPosts: sort };
}
