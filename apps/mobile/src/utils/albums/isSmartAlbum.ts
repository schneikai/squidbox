import type { AlbumRecord } from '@squidbox/shared';

export default function isSmartAlbum(album: Pick<AlbumRecord, 'smartAlbumType'>): boolean {
  return !!album.smartAlbumType;
}
