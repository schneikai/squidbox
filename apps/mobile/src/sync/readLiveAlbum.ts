import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';

/** The album with this id, or null when it is gone or deleted. */
export default async function readLiveAlbum(db: SyncDb, albumId: string): Promise<schema.AlbumRow | null> {
  const [album] = await readByIds(db, schema.albums, [albumId]);
  return album && album.deletedAt === null ? album : null;
}
