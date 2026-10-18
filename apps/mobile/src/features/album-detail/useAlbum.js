import { schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * One album, live: `undefined` until read, `null` when it doesn't exist or was deleted. After a
 * change of `albumId` it is `undefined` again until that album is read, not the previous one's.
 */
export default function useAlbum(albumId) {
  const result = useLiveQuery(
    async (db) => {
      const [album] = await readByIds(db, schema.albums, [albumId]);
      return { albumId, album: album && !album.deletedAt ? album : null };
    },
    [schema.albums],
    [albumId],
  );
  return result?.albumId === albumId ? result.album : undefined;
}
