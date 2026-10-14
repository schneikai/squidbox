import { and, getTableColumns, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import * as schema from '@/sync/db/schema';
import { readByIds } from '@/sync/readByIds';

const al = alias(schema.albums, 'al');

// The stats are correlated columns, as raw SQL: drizzle strips the table from every column of a
// single-table selection, `al.id` included. Each CASE branch is a whole subquery with its own plain
// WHERE, so each uses its index (a shared scope CASE inside one subquery's WHERE measured 435 ms
// per album). SQLite orders NULL first ascending and last descending, as the asset grid does.
const LIVE_ASSET = 'a.deleted_at is null';
const ALBUM_MEMBER = `a.id in (select asset_id from album_assets where album_id = al.id and deleted_at is null)`;
const FAVORITE = `${LIVE_ASSET} and a.is_favorite = 1`;
const LAST_POSTED_AT =
  '(select max(p.posted_at) from post_assets pe join posts p on p.id = pe.post_id where pe.asset_id = a.id and pe.deleted_at is null and p.deleted_at is null)';

function assetOrder(assetSort) {
  const direction = assetSort.endsWith(':asc') ? 'asc' : 'desc';
  const byDate = `a.created_at ${direction}, a.id ${direction}`;
  return assetSort.startsWith('lastPostedAt') ? `${LAST_POSTED_AT} ${direction}, ${byDate}` : byDate;
}

const firstAsset = (where, order) => `(select a.id from assets a where ${where} order by ${order} limit 1)`;

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
  const order = assetOrder(assetSort);
  const assetCount = sql.raw(`case al.smart_album_type
    when 'FAVORITES' then (select count(*) from assets a where ${FAVORITE})
    when 'DELETED' then (select count(*) from assets a where a.deleted_at is not null)
    else (select count(distinct e.asset_id) from album_assets e join assets a on a.id = e.asset_id where e.album_id = al.id and e.deleted_at is null and ${LIVE_ASSET})
  end`);
  const coverAssetId = sql.raw(`case
    when al.smart_album_type = 'FAVORITES' then ${firstAsset(FAVORITE, order)}
    when al.smart_album_type = 'DELETED' then ${firstAsset('a.deleted_at is not null', 'a.deleted_at desc, a.id desc')}
    when al.sort_order = 'custom' then (select e.asset_id from album_assets e join assets a on a.id = e.asset_id where e.album_id = al.id and e.deleted_at is null and ${LIVE_ASSET} order by e.position, e.id limit 1)
    else ${firstAsset(`${LIVE_ASSET} and ${ALBUM_MEMBER}`, order)}
  end`);
  const lastPostedAt = sql.raw(`case when al.smart_album_type is null then (select max(p.posted_at) from album_assets e
    join post_assets pe on pe.asset_id = e.asset_id and pe.deleted_at is null
    join posts p on p.id = pe.post_id and p.deleted_at is null
    where e.album_id = al.id and e.deleted_at is null) end`);
  const inScope =
    scope === 'all'
      ? undefined
      : sql`exists (select 1 from ${schema.albumAssets} where ${schema.albumAssets.albumId} = ${al.id} and ${schema.albumAssets.deletedAt} is null and ${schema.albumAssets.assetId} in (select value from json_each(${JSON.stringify(scope.assetIds)})))`;

  return {
    descriptor: { scope, assetSort },
    tables: [schema.albums, schema.albumAssets, schema.assets, schema.posts, schema.postAssets],
    page(db) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ ...getTableColumns(al), assetCount, coverAssetId, lastPostedAt })
          .from(al)
          .where(and(isNull(al.deletedAt), inScope));
        const covers = new Map(
          (await readByIds(tx, schema.assets, rows.map((row) => row.coverAssetId).filter(Boolean))).map((a) => [
            a.id,
            a,
          ]),
        );
        return rows.map(({ coverAssetId: coverId, ...album }) => ({ ...album, cover: covers.get(coverId) ?? null }));
      });
    },
  };
}
