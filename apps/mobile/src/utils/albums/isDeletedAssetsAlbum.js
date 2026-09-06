import { SMART_ALBUM_TYPES } from './constants';

export default function isDeletedAssetsAlbum(album) {
  return album.smartAlbumType === SMART_ALBUM_TYPES.DELETED;
}
