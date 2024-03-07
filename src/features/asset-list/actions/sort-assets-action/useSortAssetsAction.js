import { useState } from 'react';

export default function useSortAssetsAction({ afterSort } = {}) {
  const sortOptions = {
    'createdAt:asc': (a, b) => {
      if (a.createdAt === null) return -1;
      if (b.createdAt === null) return 1;
      return a.createdAt - b.createdAt;
    },
    'createdAt:desc': (a, b) => {
      if (a.createdAt === null) return 1;
      if (b.createdAt === null) return -1;
      return b.createdAt - a.createdAt;
    },
    'lastPostedAt:asc': (a, b) => {
      if (a.lastPostedAt === null) return -1;
      if (b.lastPostedAt === null) return 1;
      return a.lastPostedAt - b.lastPostedAt;
    },
    'lastPostedAt:desc': (a, b) => {
      if (a.lastPostedAt === null) return 1;
      if (b.lastPostedAt === null) return -1;
      return b.lastPostedAt - a.lastPostedAt;
    },
  };

  const defaultSortOrder = 'createdAt:desc';

  const [sortOrder, setSortOrder] = useState(defaultSortOrder);
  const [sortFunction, setSortFunction] = useState(() => sortOptions[defaultSortOrder]);

  function sortAssets(sort) {
    setSortOrder(sort);
    setSortFunction(() => sortOptions[sort]);
    if (afterSort) afterSort();
  }

  return {
    sortOrder,
    sortFunction,
    sortAssets,
  };
}
