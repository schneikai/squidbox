import type { AlbumRecord } from '@squidbox/shared';

// An album on Custom order (synced) shows its own manual order; any other shows the sort picked for
// it on this device (albumSortOrders, by album id), Newest first until one is.
export default function getAlbumSortOrder(
  album: Pick<AlbumRecord, 'id' | 'sortOrder'>,
  albumSortOrders: Partial<Record<string, string>>,
): string {
  if (album.sortOrder === 'custom') return 'custom';
  return albumSortOrders[album.id] ?? 'createdAt:desc';
}
