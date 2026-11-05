import { useMemo } from 'react';

import sortAlbumsByCustomOrder from '@/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';
import useAlbumRows from '@/features/album-list/useAlbumRows';

/**
 * The albums holding any of `assetIds`, live, in the albums' custom order, each with its stats and
 * `heldCount` (how many of the assets it holds); undefined while reading. `isLive: false` reads them
 * once (useLiveQuery's). The rows are albumQuery's, loosely typed until that feature is TypeScript.
 */
export default function useAssetAlbums(assetIds: string[], { isLive }: { isLive?: boolean } = {}) {
  const { rows } = useAlbumRows({ assetIds }, { isLive });
  return useMemo(() => rows && [...rows].sort(sortAlbumsByCustomOrder), [rows]);
}
