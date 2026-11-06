import { schema } from '@/sync/db/client';
import type { AlbumRow } from '@/sync/db/schema';
import { useLiveRecord } from '@/sync/useLiveRecord';

/**
 * One album, live: `undefined` until read, `null` when it doesn't exist or was deleted. After a
 * change of `albumId` it is `undefined` again until that album is read, not the previous one's.
 */
export default function useAlbum(albumId: string | undefined): AlbumRow | null | undefined {
  return useLiveRecord(schema.albums, albumId);
}
