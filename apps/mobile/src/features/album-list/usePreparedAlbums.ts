import { useMemo } from 'react';

import { MIN_REREAD_INTERVAL } from '@/constants';
import albumSearchQuery from '@/features/album-list/albumSearchQuery';
import matchedAlbumIds from '@/features/album-list/matchedAlbumIds';
import prepareAlbums, { type PrepareAlbumsOptions } from '@/features/album-list/prepareAlbums';
import useAlbumRows from '@/features/album-list/useAlbumRows';
import { useLiveQuery } from '@/sync/useLiveQuery';
import isBlank from '@/utils/isBlank';

type UsePreparedAlbumsProps = Omit<PrepareAlbumsOptions, 'matchedIds'> & { searchText: string };

/**
 * Every album (useAlbumRows), filtered and sorted (prepareAlbums) and narrowed to the search's
 * albums (matchedAlbumIds): name, notes and the contacts on its live photos, matched as matchingIds
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
  const query = albumSearchQuery(searchText);
  const contactSearch = useLiveQuery(query.read, query.tables, [query.descriptor], {
    minInterval: MIN_REREAD_INTERVAL,
  });
  const isSearching = !isBlank(searchText);
  // A cleared search shows every album at once; a new one keeps the previous search's albums until
  // its contacts' albums are read (a few ms), so the list never flashes empty.
  const matchedIds = useMemo(
    () => (isSearching && contactSearch ? matchedAlbumIds(rows ?? [], contactSearch) : null),
    [isSearching, contactSearch, rows],
  );
  const albums = useMemo(
    () => prepareAlbums({ albums: rows ?? [], sortOrder, activeFilter, matchedIds, showSmartAlbums, showDeleted }),
    [rows, sortOrder, activeFilter, matchedIds, showSmartAlbums, showDeleted],
  );
  return { albums, rows, readAt };
}
