import { useState } from 'react';

export default function useSortPostsAction({ afterSort } = {}) {
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

  const defaultSortOrder = 'postedAt:desc';

  const [sortOrder, setSortOrder] = useState(defaultSortOrder);
  const [sortFunction, setSortFunction] = useState(() => sortOptions[defaultSortOrder]);

  function sortPosts(sort) {
    setSortOrder(sort);
    setSortFunction(() => sortOptions[sort]);
    if (afterSort) afterSort();
  }

  return {
    sortOrder,
    sortFunction,
    sortPosts,
  };
}
