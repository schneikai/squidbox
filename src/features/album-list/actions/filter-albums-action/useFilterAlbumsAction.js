import useFilter from '@/hooks/useFilter';

function matchAlbum(album, activeFilter) {
  if (activeFilter.includes('starred') && !album.isFavorite) return false;
  if (activeFilter.includes('archived') && !album.archivedAt) return false;
  return true;
}

export default function useFilterAlbumsAction({ afterFilter } = {}) {
  return useFilter(matchAlbum, { afterFilter });
}
