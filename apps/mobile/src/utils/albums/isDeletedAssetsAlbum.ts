import type { AlbumRecord } from '@squidbox/shared';

import { SMART_ALBUM_TYPES } from './constants';

export default function isDeletedAssetsAlbum(album: Pick<AlbumRecord, 'smartAlbumType'>): boolean {
  return album.smartAlbumType === SMART_ALBUM_TYPES.DELETED;
}
