import Album from '@/features/album-detail/Album';
import DeletedAssetsAlbum from '@/features/album-detail/DeletedAssetsAlbum';
import { schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';
import isDeletedAssetsAlbum from '@/utils/albums/isDeletedAssetsAlbum';

export default function AlbumScreen({ route }) {
  const { albumId } = route.params;
  const [album] = useLiveQuery((db) => readByIds(db, schema.albums, [albumId]), [schema.albums], [albumId]) ?? [];

  if (!album || album.deletedAt) return null;

  if (isDeletedAssetsAlbum(album)) {
    return <DeletedAssetsAlbum album={album} />;
  }

  return <Album album={album} />;
}
