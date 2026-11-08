import { useMemo } from 'react';

import prepareAlbums, { type PrepareAlbumsOptions } from '@/features/album-list/prepareAlbums';
import useAlbumRows from '@/features/album-list/useAlbumRows';

/** Every album, filtered, searched and sorted (prepareAlbums), with the rows as read (`rows`) and their `readAt`. */
export default function usePreparedAlbums({
  sortOrder,
  activeFilter,
  searchText,
  showSmartAlbums,
  showDeleted,
}: PrepareAlbumsOptions) {
  const { rows, readAt } = useAlbumRows('all');
  const albums = useMemo(
    () => prepareAlbums({ albums: rows ?? [], sortOrder, activeFilter, searchText, showSmartAlbums, showDeleted }),
    [rows, sortOrder, activeFilter, searchText, showSmartAlbums, showDeleted],
  );
  return { albums, rows, readAt };
}
