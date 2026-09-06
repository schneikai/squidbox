import isSmartAlbum from './isSmartAlbum';

export default function isAlbumEditable(album) {
  return !isSmartAlbum(album);
}
