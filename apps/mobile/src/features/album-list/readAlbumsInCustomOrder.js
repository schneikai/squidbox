import { isNull } from 'drizzle-orm';

import sortAlbumsByCustomOrder from '@/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';
import * as schema from '@/sync/db/schema';

/** Every live album row, in the albums' custom order (sortAlbumsByCustomOrder). */
export default async function readAlbumsInCustomOrder(db) {
  const albums = await db.select().from(schema.albums).where(isNull(schema.albums.deletedAt));
  return albums.sort(sortAlbumsByCustomOrder);
}
