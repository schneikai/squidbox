import { and, getTableColumns, isNull, sql } from 'drizzle-orm';
import { alias, QueryBuilder, type SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  a,
  albumHoldsAny,
  albumLastPostedAt,
  assetOrder,
  assetScopeWhere,
  type AssetScope,
  type AssetSort,
  contactTargetIds,
  fromScope,
  isIdScope,
} from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import type { AlbumRow, AssetRow } from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { readByIdMap } from '@/sync/readByIds';

const al = alias(schema.albums, 'al');

/** Albums holding any of these assets, each with `heldCount`, how many of them it holds; or the albums a contact is on. */
export type AlbumSubsetScope = { assetIds: string[] } | { contactId: string };

export type AlbumQueryScope = 'all' | AlbumSubsetScope;

/**
 * `oldestFirstIds`: the albums sorted Oldest first (getAlbumSortOrder), whose cover is then their
 * oldest asset unless they are on custom order.
 */
type AlbumQueryDescriptor = { scope?: AlbumQueryScope; oldestFirstIds?: string[] };

/** A row of the album list: the album with its stats and its cover; `heldCount` under an `{ assetIds }` scope, else null. */
export type AlbumListRow = AlbumRow & {
  assetCount: number;
  lastPostedAt: number | null;
  cover: AssetRow | undefined;
  heldCount: number | null;
};

type AlbumQuery = {
  descriptor: Required<AlbumQueryDescriptor>;
  tables: SQLiteTable[];
  read(db: SyncDb): Promise<AlbumListRow[]>;
};

// The stats are correlated subqueries over the asset scopes of assetQuery, so a cover is the first
// cell its album shows and a count its header's. Each CASE branch is a whole subquery with its own
// plain WHERE, so each uses its index (a shared scope CASE inside one subquery's WHERE measured
// 435 ms per album).
const thisAlbum = { albumId: sql.raw('al.id') };
const countOf = (scope: AssetScope) =>
  sql<number>`(select count(*) from assets a where ${assetScopeWhere(scope, 'createdAt:desc')})`;
// The first asset in the scope's order, as assetQuery reads it.
function firstOf(scope: AssetScope, sort?: AssetSort) {
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
 */
export default function albumQuery({ scope = 'all', oldestFirstIds = [] }: AlbumQueryDescriptor): AlbumQuery {
  const assetCount = sql<number>`case al.smart_album_type
    when 'FAVORITES' then ${countOf('favorites')}
    when 'DELETED' then ${countOf('deleted')}
    else ${countOf(thisAlbum)}
  end`;
  // The first asset under the album's date sort: Newest first unless it is one of `oldestFirstIds`.
  function firstByDate(scope: AssetScope) {
    const newest = firstOf(scope, 'createdAt:desc');
    if (!oldestFirstIds.length) return newest;
    return sql`case when ${inJson(sql.raw('al.id'), oldestFirstIds)} then ${firstOf(scope, 'createdAt:asc')} else ${newest} end`;
  }
  const coverAssetId = sql<string | null>`case
    when al.smart_album_type = 'FAVORITES' then ${firstByDate('favorites')}
    when al.smart_album_type = 'DELETED' then ${firstOf('deleted')}
    when al.sort_order = 'custom' then ${firstOf(thisAlbum, 'custom')}
    else ${firstByDate(thisAlbum)}
  end`;
  const newestPostedAt = sql<
    number | null
  >`case when al.smart_album_type is null then ${albumLastPostedAt(thisAlbum.albumId)} end`;
  const inScope = (() => {
    if (scope === 'all') return undefined;
    if (isIdScope(scope, 'contactId')) return sql`al.id in ${contactTargetIds(scope.contactId, 'album')}`;
    return albumHoldsAny(sql.raw('al.id'), scope.assetIds);
  })();
  // Under another scope there is nothing to hold: null.
  const heldCount = isIdScope(scope, 'assetIds')
    ? sql<number>`(select count(distinct asset_id) from album_assets where album_id = al.id and deleted_at is null and ${inJson(sql.raw('asset_id'), scope.assetIds)})`
    : sql<null>`null`;

  return {
    descriptor: { scope, oldestFirstIds },
    tables: [
      schema.albums,
      schema.albumAssets,
      schema.assets,
      schema.posts,
      schema.postAssets,
      ...(isIdScope(scope, 'contactId') ? [schema.contactLinks] : []),
    ],
    read(db) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ ...getTableColumns(al), assetCount, coverAssetId, lastPostedAt: newestPostedAt, heldCount })
          .from(al)
          .where(and(isNull(al.deletedAt), inScope));
        const covers = await readByIdMap(
          tx,
          schema.assets,
          rows.map((row) => row.coverAssetId).filter((id) => id !== null),
        );
        return rows.map(({ coverAssetId: coverId, ...album }) => ({
          ...album,
          cover: coverId === null ? undefined : covers.get(coverId),
        }));
      });
    },
  };
}
