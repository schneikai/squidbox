import Album from '@/features/album-detail/Album';
import DeletedAssetsAlbum from '@/features/album-detail/DeletedAssetsAlbum';
import useAlbums from '@/features/albums-context/useAlbums';
import isDeletedAssetsAlbum from '@/utils/albums/isDeletedAssetsAlbum';

export default function AlbumScreen({ route }) {
  const { albums } = useAlbums();
  const { albumId } = route.params;
  const album = albums[albumId];

  if (isDeletedAssetsAlbum(album)) {
    return <DeletedAssetsAlbum album={album} />;
  }

  return <Album album={album} />;
}
