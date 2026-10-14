import sortAlbumsByCustomOrder from './sortAlbumsByCustomOrder';

import useSort from '@/hooks/useSort';

const DEFAULT_SORT_ORDER = 'custom';

const sortOptions = {
  custom: sortAlbumsByCustomOrder,
  'name:asc': (a, b) => a.name.localeCompare(b.name),
  'name:desc': (a, b) => b.name.localeCompare(a.name),
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

export default function useSortAlbumsAction({ afterSort } = {}) {
  const { sortOrder, sort } = useSort(DEFAULT_SORT_ORDER, { afterSort });
  return {
    sortOrder,
    sortFunction: sortOptions[sortOrder],
    sortAlbums: sort,
    isDefaultSortOrder: sortOrder === DEFAULT_SORT_ORDER,
  };
}
