import { useMemo } from 'react';

import sortAlbumsByCustomOrder from '@/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';
import useAlbumRows from '@/features/album-list/useAlbumRows';

/**
 * The albums of `scope` (albumQuery's: `{ assetIds }`, those holding any of the assets, each with
 * `heldCount`, how many of them it holds; `{ contactId }`, those a contact is on), live, in the
 * albums' custom order, each with its stats; undefined while reading. `isLive: false` reads them once
 * (useLiveQuery's).
 */
export default function useAssetAlbums(scope, { isLive } = {}) {
  const { rows } = useAlbumRows(scope, { isLive });
  return useMemo(() => rows && [...rows].sort(sortAlbumsByCustomOrder), [rows]);
}
