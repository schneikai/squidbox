import { and, getTableColumns, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { assetOrder, assetScopeWhere, lastPostedAt, liveAlbumAssetIds, sortsByLastPostedAt } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import { inJson } from '@/sync/inJson';
import { readByIds } from '@/sync/readByIds';

const al = alias(schema.albums, 'al');

// The stats are correlated subqueries over the asset scopes of assetQuery, so a cover is the first
// cell its album shows and a count its header's. Each CASE branch is a whole subquery with its own
// plain WHERE, so each uses its index (a shared scope CASE inside one subquery's WHERE measured
// 435 ms per album).
const thisAlbum = { albumId: sql.raw('al.id') };
const from = (sort) => sql.raw(sort === 'custom' ? 'album_assets e join assets a on a.id = e.asset_id' : 'assets a');
const countOf = (scope) => sql`(select count(*) from assets a where ${assetScopeWhere(scope, 'createdAt:desc')})`;
// The first asset in the scope's order, as assetQuery reads it: with the `last_posted_at` column the
// order may name, and one column left for the CASE.
function firstOf(scope, sort) {
  const key = sortsByLastPostedAt(scope, sort) ? sql`, ${lastPostedAt} as last_posted_at` : sql``;
  return sql`(select id from (select a.id${key} from ${from(sort)} where ${assetScopeWhere(scope, sort)} order by ${assetOrder(scope, sort)} limit 1))`;
}

/**
 * The album list's rows, as SQL: `page(db)` → every non-deleted album with `assetCount`, `cover`
 * (the asset it shows first, in the album's effective order) and `lastPostedAt` (`null` for the
 * smart albums, which have no edges), read in one transaction; `tables` → what a live read watches.
 * Sort, filter and search stay in JS (prepareAlbums), albums being hundreds.
 * @param {object} descriptor
 * @param {'all' | { assetIds: string[] }} [descriptor.scope] albums holding any of these assets
 * @param {'createdAt:asc' | 'createdAt:desc' | 'lastPostedAt:asc' | 'lastPostedAt:desc'} [descriptor.assetSort]
 *   the shared album-asset sort, which decides the cover of albums not on custom order
 */
export default function albumQuery({ scope = 'all', assetSort = 'createdAt:desc' }) {
  const assetCount = sql`case al.smart_album_type
    when 'FAVORITES' then ${countOf('favorites')}
    when 'DELETED' then ${countOf('deleted')}
    else ${countOf(thisAlbum)}
  end`;
  const coverAssetId = sql`case
    when al.smart_album_type = 'FAVORITES' then ${firstOf('favorites', assetSort)}
    when al.smart_album_type = 'DELETED' then ${firstOf('deleted', assetSort)}
    when al.sort_order = 'custom' then ${firstOf(thisAlbum, 'custom')}
    else ${firstOf(thisAlbum, assetSort)}
  end`;
  const newestPostedAt = sql`case when al.smart_album_type is null then (select max(p.posted_at) from post_assets pe
    join posts p on p.id = pe.post_id and p.deleted_at is null
    where pe.asset_id in ${liveAlbumAssetIds(thisAlbum.albumId)} and pe.deleted_at is null) end`;
  const inScope =
    scope === 'all'
      ? undefined
      : sql`exists (select 1 from album_assets where album_id = al.id and deleted_at is null and ${inJson(sql.raw('asset_id'), scope.assetIds)})`;

  return {
    descriptor: { scope, assetSort },
    tables: [schema.albums, schema.albumAssets, schema.assets, schema.posts, schema.postAssets],
    page(db) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ ...getTableColumns(al), assetCount, coverAssetId, lastPostedAt: newestPostedAt })
          .from(al)
          .where(and(isNull(al.deletedAt), inScope));
        const covers = new Map(
          (await readByIds(tx, schema.assets, rows.map((row) => row.coverAssetId).filter(Boolean))).map((a) => [
            a.id,
            a,
          ]),
        );
        return rows.map(({ coverAssetId: coverId, ...album }) => ({ ...album, cover: covers.get(coverId) }));
      });
    },
  };
}
