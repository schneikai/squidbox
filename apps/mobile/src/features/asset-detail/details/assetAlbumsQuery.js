import { and, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { assetScopeWhere } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';

const al = alias(schema.albums, 'al');
// Counted as the album list counts it (albumQuery).
const assetCount = sql`(select count(*) from assets a where ${assetScopeWhere({ albumId: sql.raw('al.id') }, 'createdAt:desc')})`;

/**
 * The albums holding an asset through a live edge, with what their custom order sorts by and their
 * `assetCount`: `read(db)`; `tables` → what a live read watches.
 */
export default function assetAlbumsQuery(assetId) {
  return {
    tables: [schema.albums, schema.albumAssets, schema.assets],
    read(db) {
      return db
        .select({ id: al.id, name: al.name, position: al.position, createdAt: al.createdAt, assetCount })
        .from(al)
        .where(
          and(
            isNull(al.deletedAt),
            sql`${al.id} in (select album_id from album_assets where asset_id = ${assetId} and deleted_at is null)`,
          ),
        );
    },
  };
}
