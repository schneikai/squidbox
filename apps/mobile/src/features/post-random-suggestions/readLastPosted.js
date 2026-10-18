import { and, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import sortAlbumsByCustomOrder from '@/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';
import sortAlbumsByLastPostedDesc from '@/features/album-list/actions/sort-albums-action/sortAlbumsByLastPostedDesc';
import { a, albumLastPostedAt, lastPostedAt } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';

const al = alias(schema.albums, 'al');

/** What readLastPosted reads, for a live read to watch. */
export const lastPostedTables = [schema.albums, schema.albumAssets, schema.posts, schema.postAssets];

/**
 * When the asset was last posted, and of the albums holding it the one posted most recently (when
 * none was, the first in the albums' custom order): `{ lastPostedAt, album: { name, lastPostedAt } }`,
 * each `lastPostedAt` `null` for never, `album` `null` when it is in no album.
 */
export default async function readLastPosted(db, assetId) {
  const [[asset], albums] = await Promise.all([
    db.select({ lastPostedAt }).from(a).where(eq(a.id, assetId)),
    db
      .select({
        id: al.id,
        name: al.name,
        position: al.position,
        createdAt: al.createdAt,
        lastPostedAt: albumLastPostedAt(sql.raw('al.id')),
      })
      .from(al)
      .where(
        and(
          isNull(al.deletedAt),
          sql`al.id in (select album_id from album_assets where asset_id = ${assetId} and deleted_at is null)`,
        ),
      ),
  ]);
  const [album] = albums.sort((x, y) => sortAlbumsByLastPostedDesc(x, y) || sortAlbumsByCustomOrder(x, y));
  return {
    lastPostedAt: asset?.lastPostedAt ?? null,
    album: album ? { name: album.name, lastPostedAt: album.lastPostedAt } : null,
  };
}
