import sortAlbumsByCustomOrder from './sortAlbumsByCustomOrder';
import sortAlbumsByLastPostedDesc from './sortAlbumsByLastPostedDesc';

import useAppSettings from '@/features/app-settings/useAppSettings';

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
  'lastPostedAt:desc': sortAlbumsByLastPostedDesc,
};

// The albums list's sort, remembered across launches (albumListSortOrder); a stored key no longer
// offered falls back to Custom. `afterSort` runs on every change.
export default function useSortAlbumsAction({ afterSort } = {}) {
  const { albumListSortOrder, setAlbumListSortOrder } = useAppSettings();
  const sortOrder = sortOptions[albumListSortOrder] ? albumListSortOrder : 'custom';

  function sortAlbums(order) {
    setAlbumListSortOrder(order);
    if (afterSort) afterSort();
  }

  return {
    sortOrder,
    sortFunction: sortOptions[sortOrder],
    sortAlbums,
    isSortedByLastPosted: sortOrder.startsWith('lastPostedAt'),
  };
}
