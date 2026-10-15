import { sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import * as schema from './db/schema';
import { isCanonicalEdge } from './edgeSql';

// The SQL an asset scope is read with, shared by the asset grids (assetQuery), the album list's stats
// (albumQuery) and the post lists (postQuery), so a grid, its count and its album's cover agree. It
// is written over fixed names, `a` for the assets and `e` for an album's edges when they drive the
// read (the custom order), and mostly as raw SQL: drizzle strips the table from every column of a
// single-table selection, `a.id` included.
export const a = alias(schema.assets, 'a');
export const e = alias(schema.albumAssets, 'e');

/** An asset scope: the library, a smart album, or an album by id (a value, or SQL naming a column). */
export type AssetScope = 'library' | 'favorites' | 'deleted' | { albumId: string | SQL };

/** The ids of an album's assets, through its live edges. */
export function liveAlbumAssetIds(albumId: string | SQL): SQL {
  return sql`(select asset_id from album_assets where album_id = ${albumId} and deleted_at is null)`;
}

// When the asset was last posted: SQLite orders NULL (never posted) first ascending and last
// descending, as the grid always did. A read under a lastPostedAt sort selects it as
// `last_posted_at`, and the order names that column, so SQLite runs the subquery once per row (an
// identical expression in ORDER BY would run it again).
export const lastPostedAt = sql`(select max(p.posted_at) from post_assets pe join posts p on p.id = pe.post_id where pe.asset_id = a.id and pe.deleted_at is null and p.deleted_at is null)`;

/** Whether the scope's order reads `last_posted_at`, which the read then has to select. */
export function sortsByLastPostedAt(scope: AssetScope, sort: string): boolean {
  return scope !== 'deleted' && sort.startsWith('lastPostedAt');
}

/**
 * The assets of a scope. The custom order drives from the album's edges (`e`, joined to `a`) and
 * keeps one canonical edge per asset; every other album read is the membership subquery.
 */
export function assetScopeWhere(scope: AssetScope, sort: string): SQL {
  if (scope === 'favorites') return sql`a.deleted_at is null and a.is_favorite = 1`;
  if (scope === 'deleted') return sql`a.deleted_at is not null`;
  if (scope === 'library') return sql`a.deleted_at is null`;
  if (sort === 'custom') {
    return sql`a.deleted_at is null and e.album_id = ${scope.albumId} and e.deleted_at is null and ${isCanonicalEdge(schema.albumAssets, e, 'albumId')}`;
  }
  return sql`a.deleted_at is null and a.id in ${liveAlbumAssetIds(scope.albumId)}`;
}

/**
 * The order of a scope's assets, ending with an id tie-break so refreshes and pages see one order.
 * The Deleted scope has no sort menu and lists the most recently deleted first.
 */
export function assetOrder(scope: AssetScope, sort: string): SQL {
  if (scope === 'deleted') return sql`a.deleted_at desc, a.id desc`;
  if (sort === 'custom') return sql`e.position, e.id`;
  if (sort === 'random') return sql`random()`;
  const direction = sql.raw(sort.endsWith(':asc') ? 'asc' : 'desc');
  const byDate = sql`a.created_at ${direction}, a.id ${direction}`;
  return sortsByLastPostedAt(scope, sort) ? sql`last_posted_at ${direction}, ${byDate}` : byDate;
}
