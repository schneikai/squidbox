import { eq } from 'drizzle-orm';

import sortAlbumsByCustomOrder from '@/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';
import albumQuery from '@/features/album-list/albumQuery';
import { a, lastPostedAt } from '@/sync/assetSql';

/**
 * When the asset was last posted, and of the albums holding it the one posted most recently (when
 * none was, the first in the albums' custom order): `{ lastPostedAt, album: { name, lastPostedAt } }`,
 * each `lastPostedAt` `null` for never, `album` `null` when it is in no album. It reads the assets,
 * albums and posts with their edges.
 */
export default async function readLastPosted(db, assetId) {
  const [asset] = await db.select({ lastPostedAt }).from(a).where(eq(a.id, assetId));
  const albums = await albumQuery({ scope: { assetIds: [assetId] } }).read(db);
  const [album] = albums.sort((x, y) => (y.lastPostedAt ?? 0) - (x.lastPostedAt ?? 0) || sortAlbumsByCustomOrder(x, y));
  return {
    lastPostedAt: asset?.lastPostedAt ?? null,
    album: album ? { name: album.name, lastPostedAt: album.lastPostedAt } : null,
  };
}
