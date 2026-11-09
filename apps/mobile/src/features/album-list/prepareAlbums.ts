import albumSortFunctions from '@/features/album-list/actions/sort-albums-action/albumSortFunctions';
import type { AlbumSort } from '@/features/album-list/actions/sort-albums-action/isAlbumSort';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import isDeletedAssetsAlbum from '@/utils/albums/isDeletedAssetsAlbum';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';

const ALBUM_FILTERS = ['starred', 'archived'] as const;
export type AlbumFilter = (typeof ALBUM_FILTERS)[number];

/** How prepareAlbums picks and orders the albums (all but the albums themselves). */
export type PrepareAlbumsOptions = {
  sortOrder: AlbumSort;
  activeFilter?: AlbumFilter[];
  /** The albums the search found (albumSearchQuery); null: no search. */
  matchedIds: ReadonlySet<string> | null;
  showSmartAlbums?: boolean;
  showDeleted?: boolean;
};

function matchesFilter(album: Pick<AlbumListRow, 'isFavorite' | 'archivedAt'>, activeFilter: AlbumFilter[]) {
  if (activeFilter.includes('starred') && !album.isFavorite) return false;
  // Archived albums show only under the "archived" filter, and then only they do.
  if (activeFilter.includes('archived') !== Boolean(album.archivedAt)) return false;
  return true;
}

// The albums to list: filtered by `activeFilter` (albumFilterOptions), narrowed to `matchedIds`
// (albumSearchQuery) and sorted by `sortOrder` (albumSortFunctions). Smart albums show unless `showSmartAlbums` is false, the Deleted one
// unless `showDeleted` is.
export default function prepareAlbums({
  albums,
  sortOrder,
  activeFilter = [],
  matchedIds,
  showSmartAlbums = true,
  showDeleted = true,
}: { albums: AlbumListRow[] } & PrepareAlbumsOptions): AlbumListRow[] {
  const matchedAlbums = albums.filter((album) => {
    if (!showSmartAlbums && isSmartAlbum(album)) return false;
    if (!showDeleted && isDeletedAssetsAlbum(album)) return false;
    if (!matchesFilter(album, activeFilter)) return false;
    if (matchedIds && !matchedIds.has(album.id)) return false;
    return true;
  });

  return matchedAlbums.sort(albumSortFunctions[sortOrder]);
}
