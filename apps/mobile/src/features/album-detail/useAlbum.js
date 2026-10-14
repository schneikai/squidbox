import { schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** One album, live: `undefined` until read, `null` when it doesn't exist or was deleted. */
export default function useAlbum(albumId) {
  return useLiveQuery(
    async (db) => {
      const [album] = await readByIds(db, schema.albums, [albumId]);
      return album && !album.deletedAt ? album : null;
    },
    [schema.albums],
    [albumId],
  );
}
