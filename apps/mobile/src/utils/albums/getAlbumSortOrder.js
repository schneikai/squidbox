// An album on custom order shows its own manual order; every other album follows the shared sort.
export default function getAlbumSortOrder(album, globalSortOrder) {
  return album.sortOrder === 'custom' ? 'custom' : globalSortOrder;
}
