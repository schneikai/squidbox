import { useMemo } from 'react';

import sortAlbumsByCustomOrder from '@/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';
import useAlbumRows from '@/features/album-list/useAlbumRows';

/**
 * The albums holding any of `assetIds`, live, in the albums' custom order, each with its stats and
 * `heldCount` (how many of the assets it holds); undefined while reading. `isLive: false` reads them
 * once (useLiveQuery's).
 */
export default function useAssetAlbums(assetIds, { isLive } = {}) {
  const { rows } = useAlbumRows({ assetIds }, { isLive });
  return useMemo(() => rows && [...rows].sort(sortAlbumsByCustomOrder), [rows]);
}
