import { useMemo } from 'react';

import prepareAlbums from '@/features/album-list/prepareAlbums';
import useAlbumRows from '@/features/album-list/useAlbumRows';

/** Every album, filtered, searched and sorted (prepareAlbums), with the rows' `readAt`. */
type PreparedAlbumsOptions = Omit<Parameters<typeof prepareAlbums>[0], 'albums'>;

export default function usePreparedAlbums({
  sortOrder,
  activeFilter,
  searchText,
  showSmartAlbums,
  showDeleted,
}: PreparedAlbumsOptions) {
  const { rows, readAt } = useAlbumRows('all');
  const albums = useMemo(
    () => prepareAlbums({ albums: rows ?? [], sortOrder, activeFilter, searchText, showSmartAlbums, showDeleted }),
    [rows, sortOrder, activeFilter, searchText, showSmartAlbums, showDeleted],
  );
  return { albums, readAt };
}
