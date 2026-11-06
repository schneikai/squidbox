import type { AlbumSort } from '@/features/album-list/actions/sort-albums-action/albumSortFunctions';
import albumSortFunctions from '@/features/album-list/actions/sort-albums-action/albumSortFunctions';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import isDeletedAssetsAlbum from '@/utils/albums/isDeletedAssetsAlbum';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';
import isBlank from '@/utils/isBlank';

export type AlbumFilter = 'starred' | 'archived';

function matchesFilter(album: Pick<AlbumListRow, 'isFavorite' | 'archivedAt'>, activeFilter: AlbumFilter[]) {
  if (activeFilter.includes('starred') && !album.isFavorite) return false;
  // Archived albums show only under the "archived" filter, and then only they do.
  if (activeFilter.includes('archived') !== Boolean(album.archivedAt)) return false;
  return true;
}

// The albums to list: filtered by `activeFilter` (albumFilterOptions), searched by name and sorted by
// `sortOrder` (albumSortFunctions). Smart albums show unless `showSmartAlbums` is false, the Deleted one
// unless `showDeleted` is.
export default function prepareAlbums({
  albums,
  sortOrder,
  activeFilter = [],
  searchText,
  showSmartAlbums = true,
  showDeleted = true,
}: {
  albums: AlbumListRow[];
  sortOrder: AlbumSort;
  activeFilter?: AlbumFilter[];
  searchText: string;
  showSmartAlbums?: boolean;
  showDeleted?: boolean;
}): AlbumListRow[] {
  const search = isBlank(searchText) ? null : searchText.toLowerCase();
  const matchedAlbums = albums.filter((album) => {
    if (!showSmartAlbums && isSmartAlbum(album)) return false;
    if (!showDeleted && isDeletedAssetsAlbum(album)) return false;
    if (!matchesFilter(album, activeFilter)) return false;
    if (search && !album.name.toLowerCase().includes(search)) return false;
    return true;
  });

  return matchedAlbums.sort(albumSortFunctions[sortOrder]);
}
