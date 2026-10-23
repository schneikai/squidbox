import albumSortFunctions from './albumSortFunctions';

import useAppSettings from '@/features/app-settings/useAppSettings';

// The albums list's sort, remembered across launches (albumListSortOrder); a stored key no longer
// offered falls back to Newest first.
export default function useSortAlbumsAction() {
  const { albumListSortOrder, setAlbumListSortOrder } = useAppSettings();
  const sortOrder = albumSortFunctions[albumListSortOrder] ? albumListSortOrder : 'createdAt:desc';

  return { sortOrder, sortAlbums: setAlbumListSortOrder, isSortedByLastPosted: sortOrder.startsWith('lastPostedAt') };
}
