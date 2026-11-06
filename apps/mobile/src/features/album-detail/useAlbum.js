import { schema } from '@/sync/db/client';
import { useLiveRecord } from '@/sync/useLiveRecord';

/**
 * One album, live: `undefined` until read, `null` when it doesn't exist or was deleted. After a
 * change of `albumId` it is `undefined` again until that album is read, not the previous one's.
 *
 * @returns {import('@/sync/db/schema').AlbumRow | null | undefined}
 */
export default function useAlbum(albumId) {
  return useLiveRecord(schema.albums, albumId);
}
