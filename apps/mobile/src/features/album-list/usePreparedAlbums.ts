import { useMemo } from 'react';

import { MIN_REREAD_INTERVAL } from '@/constants';
import albumSearchQuery from '@/features/album-list/albumSearchQuery';
import matchedAlbumIds from '@/features/album-list/matchedAlbumIds';
import prepareAlbums, { type PrepareAlbumsOptions } from '@/features/album-list/prepareAlbums';
import useAlbumRows from '@/hooks/useAlbumRows';
import { useLiveQuery } from '@/sync/useLiveQuery';

const NO_IDS: string[] = [];

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
  // Names and notes match the current search at once; its contacts' albums join once read for it
  // (a few ms), so a keystroke never waits for the db, nor shows an earlier search's contacts.
  const contactAlbumIds = contactSearch?.search === searchText.trim() ? contactSearch.contactAlbumIds : NO_IDS;
  const matchedIds = useMemo(
    () => matchedAlbumIds(rows ?? [], searchText, contactAlbumIds),
    [rows, searchText, contactAlbumIds],
  );
  const albums = useMemo(
    () => prepareAlbums({ albums: rows ?? [], sortOrder, activeFilter, matchedIds, showSmartAlbums, showDeleted }),
    [rows, sortOrder, activeFilter, matchedIds, showSmartAlbums, showDeleted],
  );
  return { albums, rows, readAt };
}
