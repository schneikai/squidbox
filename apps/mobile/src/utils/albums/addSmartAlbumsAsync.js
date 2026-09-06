import albumSchema from './albumSchema';

export default async function addSmartAlbumsAsync(albums) {
  const favoritesAlbum = findAlbumBySmartAlbumType(albums, 'FAVORITES');
  if (!favoritesAlbum) {
    const newAlbum = albumSchema.cast({ name: 'Favorites', smartAlbumType: 'FAVORITES' });
    albums[newAlbum.id] = newAlbum;
  }

  const deletedAssetsAlbum = findAlbumBySmartAlbumType(albums, 'DELETED');
  if (!deletedAssetsAlbum) {
    const newAlbum = albumSchema.cast({ name: 'Deleted', smartAlbumType: 'DELETED' });
    albums[newAlbum.id] = newAlbum;
  }
}

function findAlbumBySmartAlbumType(albums, smartAlbumType) {
  return Object.values(albums).find((album) => album.smartAlbumType === smartAlbumType);
}
