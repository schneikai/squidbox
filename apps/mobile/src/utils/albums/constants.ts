import type { AlbumRecord } from '@squidbox/shared';

export const SMART_ALBUM_TYPES = {
  FAVORITES: 'FAVORITES',
  DELETED: 'DELETED',
} as const satisfies Record<string, NonNullable<AlbumRecord['smartAlbumType']>>;
