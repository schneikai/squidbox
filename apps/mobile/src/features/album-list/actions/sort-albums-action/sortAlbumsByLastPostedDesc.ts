import type { AlbumListRow } from '@/sync/queries/albumQuery';

export type PostedAlbum = Pick<AlbumListRow, 'lastPostedAt'>;

// Albums by when they were last posted, newest first, the never posted (`lastPostedAt` null) last.
export default function sortAlbumsByLastPostedDesc(a: PostedAlbum, b: PostedAlbum): number {
  if (a.lastPostedAt === b.lastPostedAt) return 0;
  if (a.lastPostedAt === null) return 1;
  if (b.lastPostedAt === null) return -1;
  return b.lastPostedAt - a.lastPostedAt;
}
