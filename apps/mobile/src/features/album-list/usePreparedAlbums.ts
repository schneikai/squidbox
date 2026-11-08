import { useMemo } from 'react';

import albumSearchQuery from '@/features/album-list/albumSearchQuery';
import prepareAlbums, { type PrepareAlbumsOptions } from '@/features/album-list/prepareAlbums';
import useAlbumRows from '@/features/album-list/useAlbumRows';
import { useLiveQuery } from '@/sync/useLiveQuery';

type UsePreparedAlbumsProps = Omit<PrepareAlbumsOptions, 'matchedIds'> & { searchText: string };

/**
 * Every album (useAlbumRows), filtered and sorted (prepareAlbums) and narrowed to the search's
 * albums (albumSearchQuery): name, notes and the contacts on its live photos, matched as matchingIds
 * does; `rows` are every album as read, and their `readAt`.
 */
export default function usePreparedAlbums({
  sortOrder,
  activeFilter,
  searchText,
  showSmartAlbums,
  showDeleted,
}: UsePreparedAlbumsProps) {
  const { rows, readAt } = useAlbumRows('all');
  const search = albumSearchQuery(searchText);
  // undefined: a search whose first read hasn't landed lists nothing yet, as the asset grids do.
  const ids = useLiveQuery(search.read, search.tables, [search.descriptor]);
  const matchedIds = useMemo(() => (ids === null ? null : new Set(ids ?? [])), [ids]);
  const albums = useMemo(
    () => prepareAlbums({ albums: rows ?? [], sortOrder, activeFilter, matchedIds, showSmartAlbums, showDeleted }),
    [rows, sortOrder, activeFilter, matchedIds, showSmartAlbums, showDeleted],
  );
  return { albums, rows, readAt };
}
