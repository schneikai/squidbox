// An album on Custom order (synced) shows its own manual order; any other shows the sort picked for
// it on this device (albumSortOrders, by album id), Newest first until one is.
export default function getAlbumSortOrder(album, albumSortOrders) {
  if (album.sortOrder === 'custom') return 'custom';
  return albumSortOrders[album.id] ?? 'createdAt:desc';
}
