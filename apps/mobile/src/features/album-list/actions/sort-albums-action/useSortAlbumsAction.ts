import isAlbumSort, { type AlbumSort } from './isAlbumSort';

import useAppSettings from '@/features/app-settings/useAppSettings';

// The albums list's sort, remembered across launches (albumListSortOrder); a stored key no longer
// offered falls back to Newest first.
export default function useSortAlbumsAction() {
  const { albumListSortOrder, setAlbumListSortOrder } = useAppSettings();
  const sortOrder: AlbumSort = isAlbumSort(albumListSortOrder) ? albumListSortOrder : 'createdAt:desc';
  const sortAlbums: (order: AlbumSort) => void = setAlbumListSortOrder;

  return { sortOrder, sortAlbums, isSortedByLastPosted: sortOrder.startsWith('lastPostedAt') };
}
