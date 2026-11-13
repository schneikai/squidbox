import albumSortFunctions from '@/features/album-list/actions/sort-albums-action/albumSortFunctions';
import type { AlbumListRow } from '@/sync/queries/albumQuery';

const newestFirst = albumSortFunctions['createdAt:desc'];

/**
 * The Starred row's albums: the starred ones, the last starred first, then those starred before that
 * was recorded (no `favoritedAt`), newest first. Archived ones stay out, as they do in the grid.
 */
export default function starredAlbums(albums: AlbumListRow[]): AlbumListRow[] {
  return albums
    .filter((album) => album.isFavorite && !album.archivedAt)
    .sort((a, b) => (b.favoritedAt ?? 0) - (a.favoritedAt ?? 0) || newestFirst(a, b));
}
