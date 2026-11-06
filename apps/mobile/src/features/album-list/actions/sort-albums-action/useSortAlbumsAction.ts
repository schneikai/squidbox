import { type AlbumSort, isAlbumSort } from './albumSortFunctions';

import type { AppSettingsSetters } from '@/features/app-settings/AppSettingsContext';
import useAppSettings from '@/features/app-settings/useAppSettings';

// The albums list's sort, remembered across launches (albumListSortOrder); a stored key no longer
// offered falls back to Newest first.
export default function useSortAlbumsAction(): {
  sortOrder: AlbumSort;
  sortAlbums: AppSettingsSetters['setAlbumListSortOrder'];
  isSortedByLastPosted: boolean;
} {
  const { albumListSortOrder, setAlbumListSortOrder } = useAppSettings();
  const sortOrder = isAlbumSort(albumListSortOrder) ? albumListSortOrder : 'createdAt:desc';

  return { sortOrder, sortAlbums: setAlbumListSortOrder, isSortedByLastPosted: sortOrder.startsWith('lastPostedAt') };
}
