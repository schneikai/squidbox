import { isNull } from 'drizzle-orm';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import sortAlbumsByCustomOrder from '@/utils/albums/sortAlbumsByCustomOrder';

/** Every live album row, in the albums' custom order (sortAlbumsByCustomOrder). */
export default async function readAlbumsInCustomOrder(db: SyncDb): Promise<schema.AlbumRow[]> {
  const albums = await db.select().from(schema.albums).where(isNull(schema.albums.deletedAt));
  return albums.sort(sortAlbumsByCustomOrder);
}
