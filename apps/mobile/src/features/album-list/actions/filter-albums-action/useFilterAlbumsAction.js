import { useCallback } from 'react';

import useFilter from '@/hooks/useFilter';

function matchAlbum(album, activeFilter) {
  if (activeFilter.includes('starred') && !album.isFavorite) return false;
  if (activeFilter.includes('archived') && !album.archivedAt) return false;
  return true;
}

// Albums filter in JS (prepareAlbums); `matchFilter` is stable until the filter changes.
export default function useFilterAlbumsAction({ afterFilter } = {}) {
  const { activeFilter, toggleFilter } = useFilter({ afterFilter });
  const matchFilter = useCallback(
    (album) => activeFilter.length === 0 || matchAlbum(album, activeFilter),
    [activeFilter],
  );
  return { activeFilter, matchFilter, toggleFilter };
}
