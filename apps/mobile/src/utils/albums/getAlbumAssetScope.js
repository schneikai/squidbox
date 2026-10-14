import { SMART_ALBUM_TYPES } from './constants';

/** The assetQuery scope that shows an album's assets: the smart albums are predicates, not edges. */
export default function getAlbumAssetScope(album) {
  if (album.smartAlbumType === SMART_ALBUM_TYPES.FAVORITES) return 'favorites';
  if (album.smartAlbumType === SMART_ALBUM_TYPES.DELETED) return 'deleted';
  return { albumId: album.id };
}
