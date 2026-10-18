import { and, getTableColumns, isNull, sql } from 'drizzle-orm';
import { alias, QueryBuilder } from 'drizzle-orm/sqlite-core';

import {
  a,
  assetOrder,
  assetScopeWhere,
  fromScope,
  lastPostedAt,
  liveAlbumAssetIds,
  sortsByLastPostedAt,
} from '@/sync/assetSql';
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
// The first asset in the scope's order, as assetQuery reads it: with the `last_posted_at` column the
// order may name, and one column left for the CASE.
function firstOf(scope, sort) {
  const fields = sortsByLastPostedAt(scope, sort)
    ? { id: a.id, lastPostedAt: lastPostedAt.as('last_posted_at') }
    : { id: a.id };
  const first = fromScope(new QueryBuilder().select(fields), scope, sort)
    .where(assetScopeWhere(scope, sort))
    .orderBy(assetOrder(scope, sort))
    .limit(1);
  return sql`(select id from (${first}))`;
}

/**
 * The album list's rows, as SQL: `read(db)` → every non-deleted album with `assetCount`, `cover`
 * (the asset it shows first, in the album's effective order) and `lastPostedAt` (`null` for the
 * smart albums, which have no edges; skipped with `withLastPostedAt: false`, which then doesn't
 * watch the posts either), read in one transaction; `tables` → what a live read watches.
 * Sort, filter and search stay in JS (prepareAlbums), albums being hundreds.
 * @param {object} descriptor
 * @param {'all' | { assetIds: string[] }} [descriptor.scope] albums holding any of these assets
 * @param {'createdAt:asc' | 'createdAt:desc' | 'lastPostedAt:asc' | 'lastPostedAt:desc'} [descriptor.assetSort]
 *   the shared album-asset sort, which decides the cover of albums not on custom order
 * @param {boolean} [descriptor.withLastPostedAt]
 */
export default function albumQuery({ scope = 'all', assetSort = 'createdAt:desc', withLastPostedAt = true }) {
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

  const tables = [schema.albums, schema.albumAssets, schema.assets];
  if (withLastPostedAt) tables.push(schema.posts, schema.postAssets);

  return {
    descriptor: { scope, assetSort, withLastPostedAt },
    tables,
    read(db) {
      return db.transaction(async (tx) => {
        const stats = withLastPostedAt ? { lastPostedAt: newestPostedAt } : {};
        const rows = await tx
          .select({ ...getTableColumns(al), assetCount, coverAssetId, ...stats })
          .from(al)
          .where(and(isNull(al.deletedAt), inScope));
        const covers = await readByIdMap(tx, schema.assets, rows.map((row) => row.coverAssetId).filter(Boolean));
        return rows.map(({ coverAssetId: coverId, ...album }) => ({ ...album, cover: covers.get(coverId) }));
      });
    },
  };
}
