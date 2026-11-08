import type { AlbumListRow } from '@/features/album-list/albumQuery';
import { matchingIds } from '@/sync/matchingIds';
import isBlank from '@/utils/isBlank';

/**
 * The albums a search finds (prepareAlbums' `matchedIds`): those whose name or notes contain
 * `searchText`, matched as `matchingIds` does, and `contactAlbumIds`, those holding a photo of a
 * contact it finds (albumSearchQuery). `null` without a search: every album.
 */
export default function matchedAlbumIds(
  albums: Pick<AlbumListRow, 'id' | 'name' | 'notes'>[],
  searchText: string,
  contactAlbumIds: string[],
): ReadonlySet<string> | null {
  if (isBlank(searchText)) return null;
  // One text per line, as contactSearchText.
  const rows = albums.map(({ id, name, notes }) => ({ id, text: [name, notes].filter(Boolean).join('\n') }));
  return new Set([...matchingIds(rows, searchText), ...contactAlbumIds]);
}
