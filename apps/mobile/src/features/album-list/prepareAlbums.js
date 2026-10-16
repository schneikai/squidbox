import isBlank from '@/utils/isBlank';

export default function prepareAlbums({ albums, sortFn, filterFn, searchText, showSmartAlbums = true }) {
  let matchedAlbums = albums.filter((album) => {
    if (!showSmartAlbums && album.smartAlbumType) return false;
    if (filterFn && !filterFn(album)) return false;
    if (!isBlank(searchText) && !(album.name || '').toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  if (sortFn) matchedAlbums = matchedAlbums.sort(sortFn);

  return matchedAlbums;
}
