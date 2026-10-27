import { and, getTableColumns, isNull, sql } from 'drizzle-orm';
import { alias, QueryBuilder } from 'drizzle-orm/sqlite-core';

import { a, albumLastPostedAt, assetOrder, assetScopeWhere, fromScope } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import { inJson } from '@/sync/inJson';
import { readByIdMap } from '@/sync/readByIds';

const al = alias(schema.albums, 'al');

// The stats are correlated subqueries over the asset scopes of assetQuery, so a cover is the first
// cell its album shows and a count its header's. Each CASE branch is a whole subquery with its own
// plain WHERE, so each uses its index (a shared scope CASE inside one subquery's WHERE measured
// 435 ms per album).
const thisAlbum = { albumId: sql.raw('al.id') };
const countOf = (scope) => sql`(select count(*) from assets a where ${assetScopeWhere(scope, 'createdAt:desc')})`;
// The first asset in the scope's order, as assetQuery reads it.
function firstOf(scope, sort) {
  const first = fromScope(new QueryBuilder().select({ id: a.id }), scope, sort)
    .where(assetScopeWhere(scope, sort))
    .orderBy(assetOrder(scope, sort))
    .limit(1);
  return sql`(${first})`;
}

/**
 * The album list's rows, as SQL: `read(db)` → every non-deleted album with `assetCount`, `cover`
 * (the asset it shows first, in the album's effective order) and `lastPostedAt` (`null` when never
 * posted, and for the smart albums, which have no edges), read in one transaction; `tables` → what
 * a live read watches.
 * Sort, filter and search stay in JS (prepareAlbums), albums being hundreds.
 * @param {object} descriptor
 * @param {'all' | { assetIds: string[] }} [descriptor.scope] albums holding any of these assets, each
 *   with `heldCount`, how many of them it holds
 * @param {string[]} [descriptor.oldestFirstIds] the albums sorted Oldest first (getAlbumSortOrder), whose
 *   cover is then their oldest asset unless they are on custom order
 */
export default function albumQuery({ scope = 'all', oldestFirstIds = [] }) {
  const assetCount = sql`case al.smart_album_type
    when 'FAVORITES' then ${countOf('favorites')}
    when 'DELETED' then ${countOf('deleted')}
    else ${countOf(thisAlbum)}
  end`;
  // The first asset under the album's date sort: Newest first unless it is one of `oldestFirstIds`.
  function firstByDate(scope) {
    const newest = firstOf(scope, 'createdAt:desc');
    if (!oldestFirstIds.length) return newest;
    return sql`case when ${inJson(sql.raw('al.id'), oldestFirstIds)} then ${firstOf(scope, 'createdAt:asc')} else ${newest} end`;
  }
  const coverAssetId = sql`case
    when al.smart_album_type = 'FAVORITES' then ${firstByDate('favorites')}
    when al.smart_album_type = 'DELETED' then ${firstOf('deleted')}
    when al.sort_order = 'custom' then ${firstOf(thisAlbum, 'custom')}
    else ${firstByDate(thisAlbum)}
  end`;
  const newestPostedAt = sql`case when al.smart_album_type is null then ${albumLastPostedAt(thisAlbum.albumId)} end`;
  const inScope =
    scope === 'all'
      ? undefined
      : sql`exists (select 1 from album_assets where album_id = al.id and deleted_at is null and ${inJson(sql.raw('asset_id'), scope.assetIds)})`;
  const held =
    scope === 'all'
      ? {}
      : {
          heldCount: sql`(select count(distinct asset_id) from album_assets where album_id = al.id and deleted_at is null and ${inJson(sql.raw('asset_id'), scope.assetIds)})`,
        };

  return {
    descriptor: { scope, oldestFirstIds },
    tables: [schema.albums, schema.albumAssets, schema.assets, schema.posts, schema.postAssets],
    read(db) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ ...getTableColumns(al), assetCount, coverAssetId, lastPostedAt: newestPostedAt, ...held })
          .from(al)
          .where(and(isNull(al.deletedAt), inScope));
        const covers = await readByIdMap(tx, schema.assets, rows.map((row) => row.coverAssetId).filter(Boolean));
        return rows.map(({ coverAssetId: coverId, ...album }) => ({ ...album, cover: covers.get(coverId) }));
      });
    },
  };
}
