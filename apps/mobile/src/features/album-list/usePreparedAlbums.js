import { useMemo } from 'react';

import prepareAlbums from '@/features/album-list/prepareAlbums';
import useAlbumRows from '@/features/album-list/useAlbumRows';

/**
 * Every album with its stats (useAlbumRows), filtered, searched and sorted in JS (prepareAlbums).
 * Recomputed only when the rows or an option change, so the list keeps its data array otherwise.
 */
export default function usePreparedAlbums({ sortFn, filterFn, searchText, showSmartAlbums }) {
  const rows = useAlbumRows('all');
  return useMemo(
    () => prepareAlbums({ albums: rows ?? [], sortFn, filterFn, searchText, showSmartAlbums }),
    [rows, sortFn, filterFn, searchText, showSmartAlbums],
  );
}
