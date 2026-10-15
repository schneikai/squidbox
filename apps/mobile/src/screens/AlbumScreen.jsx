import Album from '@/features/album-detail/Album';
import DeletedAssetsAlbum from '@/features/album-detail/DeletedAssetsAlbum';
import useAlbum from '@/features/album-detail/useAlbum';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import isDeletedAssetsAlbum from '@/utils/albums/isDeletedAssetsAlbum';

export default function AlbumScreen({ route }) {
  const { albumId } = route.params;
  const album = useAlbum(albumId);
  useCloseWhenGone(album, 'This album was deleted');

  if (!album) return null;

  if (isDeletedAssetsAlbum(album)) {
    return <DeletedAssetsAlbum album={album} />;
  }

  return <Album album={album} />;
}
