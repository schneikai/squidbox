import useSort from '@/hooks/useSort';

const sortOptions = {
  'postedAt:asc': (a, b) => {
    if (a.postedAt === null) return -1;
    if (b.postedAt === null) return 1;
    return a.postedAt - b.postedAt;
  },
  'postedAt:desc': (a, b) => {
    if (a.postedAt === null) return 1;
    if (b.postedAt === null) return -1;
    return b.postedAt - a.postedAt;
  },
};

export default function useSortPostsAction({ afterSort } = {}) {
  const { sortOrder, sortFunction, sort } = useSort(sortOptions, 'postedAt:desc', { afterSort });
  return { sortOrder, sortFunction, sortPosts: sort };
}
