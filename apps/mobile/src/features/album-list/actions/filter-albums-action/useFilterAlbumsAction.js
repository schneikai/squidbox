import { useCallback } from 'react';

import useFilter from '@/hooks/useFilter';

function matchAlbum(album, activeFilter) {
  if (activeFilter.includes('starred') && !album.isFavorite) return false;
  // Archived albums show only under the "archived" filter, and then only they do.
  if (activeFilter.includes('archived') !== Boolean(album.archivedAt)) return false;
  return true;
}

// Albums filter in JS (usePreparedAlbums); `matchFilter` is stable until the filter changes.
export default function useFilterAlbumsAction({ afterFilter } = {}) {
  const { activeFilter, toggleFilter } = useFilter({ afterFilter });
  const matchFilter = useCallback((album) => matchAlbum(album, activeFilter), [activeFilter]);
  return { activeFilter, matchFilter, toggleFilter };
}
