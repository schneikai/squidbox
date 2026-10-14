import useFilter from '@/hooks/useFilter';

function matchAlbum(album, activeFilter) {
  if (activeFilter.includes('starred') && !album.isFavorite) return false;
  if (activeFilter.includes('archived') && !album.archivedAt) return false;
  return true;
}

export default function useFilterAlbumsAction({ afterFilter } = {}) {
  const { activeFilter, toggleFilter } = useFilter({ afterFilter });
  const matchFilter = (album) => activeFilter.length === 0 || matchAlbum(album, activeFilter);
  return { activeFilter, matchFilter, toggleFilter };
}
