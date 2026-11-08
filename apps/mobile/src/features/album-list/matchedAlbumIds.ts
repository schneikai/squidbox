import type { AlbumListRow } from '@/features/album-list/albumQuery';
import type { AlbumContactSearch } from '@/features/album-list/albumSearchQuery';
import { matchingIds } from '@/sync/matchingIds';
import isBlank from '@/utils/isBlank';

/**
 * The albums an album search finds (prepareAlbums' `matchedIds`): those whose name or notes contain
 * its text, matched as `matchingIds` does, and those holding a photo of a contact it matches
 * (albumSearchQuery). `null` without a search: every album.
 */
export default function matchedAlbumIds(
  albums: Pick<AlbumListRow, 'id' | 'name' | 'notes'>[],
  { search, contactAlbumIds }: AlbumContactSearch,
): ReadonlySet<string> | null {
  if (isBlank(search)) return null;
  const rows = albums.flatMap(({ id, name, notes }) => [
    { id, text: name },
    ...(notes === null ? [] : [{ id, text: notes }]),
  ]);
  return new Set([...matchingIds(rows, search), ...contactAlbumIds]);
}
