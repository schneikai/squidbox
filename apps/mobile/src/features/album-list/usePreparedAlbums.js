import { useMemo } from 'react';

import prepareAlbums from '@/features/album-list/prepareAlbums';
import useAlbumRows from '@/features/album-list/useAlbumRows';

/** Every album, filtered, searched and sorted (prepareAlbums), kept while rows and options are: `albums` and `readAt`. */
export default function usePreparedAlbums({ sortFn, filterFn, searchText, showSmartAlbums }) {
  const { rows, readAt } = useAlbumRows('all');
  const albums = useMemo(
    () => prepareAlbums({ albums: rows ?? [], sortFn, filterFn, searchText, showSmartAlbums }),
    [rows, sortFn, filterFn, searchText, showSmartAlbums],
  );
  return { albums, readAt };
}
