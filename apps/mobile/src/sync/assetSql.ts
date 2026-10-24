import { eq, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import * as schema from './db/schema';
import { isCanonicalEdge } from './edgeSql';
import { inJson } from './inJson';

// The SQL an asset scope is read with, shared by the asset grids (assetQuery), the album list's stats
// (albumQuery) and the post lists (postQuery), so a grid, its count, its album's cover and a post's
// assets agree. It is written over fixed names, `a` for the assets and `e` for the edges when they
// drive the read (scopeEdges), and mostly as raw SQL: drizzle strips the table from every column of
// a single-table selection, `a.id` included.
export const a = alias(schema.assets, 'a');

/**
 * An asset scope: the library, a smart album (Deleted: not the purged), an album by id (a value, or
 * SQL naming a column), a post's assets as the post screen shows them, in its order, a trashed
 * one included (one post, or several for postQuery, which reads its posts' assets at once), or one
 * live asset alone (a post suggestion's).
 */
export type AssetScope =
  'library' | 'favorites' | 'deleted' | { albumId: string | SQL } | { postId: string | string[] } | { assetId: string };

function isPostScope(scope: AssetScope): scope is { postId: string | string[] } {
  return typeof scope === 'object' && 'postId' in scope;
}

const albumEdge = alias(schema.albumAssets, 'e');
const postEdge = alias(schema.postAssets, 'e');

/**
 * The edges that drive a scope's read, or `null`: a post's always, an album's under the custom
 * order. `e` joins `a` (fromScope), and `where` keeps the parents' live edges, one canonical edge
 * per asset.
 */
export function scopeEdges(scope: AssetScope, sort = 'createdAt:desc') {
  if (isPostScope(scope)) {
    const parent = sql.raw('e.post_id');
    const isOfPost = Array.isArray(scope.postId) ? inJson(parent, scope.postId) : sql`${parent} = ${scope.postId}`;
    return {
      e: postEdge,
      where: sql`${isOfPost} and e.deleted_at is null and ${isCanonicalEdge(schema.postAssets, postEdge, 'postId')}`,
    };
  }
  if (typeof scope !== 'object' || !('albumId' in scope) || sort !== 'custom') return null;
  return {
    e: albumEdge,
    where: sql`e.album_id = ${scope.albumId} and e.deleted_at is null and ${isCanonicalEdge(schema.albumAssets, albumEdge, 'albumId')}`,
  };
}

/**
 * In a post scope over several posts, an asset's place in its post (1 for the first), in the post's
 * order (assetOrder), over the edges the scope keeps: select it in a subquery and keep 1.
 */
export function placeInPost(scope: { postId: string | string[] }): SQL<number> {
  return sql<number>`row_number() over (partition by ${postEdge.postId} order by ${assetOrder(scope)})`;
}

/** A drizzle `select` from the scope's assets: `a`, joined from its edges when they drive the read. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any drizzle select builder
export function fromScope(select: any, scope: AssetScope, sort = 'createdAt:desc') {
  const edges = scopeEdges(scope, sort);
  return edges ? select.from(edges.e).innerJoin(a, eq(a.id, edges.e.assetId)) : select.from(a);
}

/** The ids of an album's assets, through its live edges. */
export function liveAlbumAssetIds(albumId: string | SQL): SQL {
  return sql`(select asset_id from album_assets where album_id = ${albumId} and deleted_at is null)`;
}

/**
 * The ids of the assets of a post's live albums (the albums holding any of the assets the post
 * screen shows, so not the purged), through live edges. A trashed asset of those albums counts, as
 * in an album's Posts tab (liveAlbumAssetIds), though the album's grid hides it.
 */
export function postAlbumAssetIds(postId: string): SQL {
  return sql`(select aa.asset_id from album_assets aa join albums al on al.id = aa.album_id and al.deleted_at is null
    where aa.deleted_at is null and aa.album_id in (
      select album_id from album_assets where deleted_at is null and asset_id in (
        select pe.asset_id from post_assets pe join assets pa on pa.id = pe.asset_id and pa.purged_at is null
        where pe.post_id = ${postId} and pe.deleted_at is null)))`;
}

/** When any of an album's assets was last posted, through its live edges: `null` for never. */
export function albumLastPostedAt(albumId: string | SQL): SQL<number | null> {
  return sql`(select max(p.posted_at) from post_assets pe join posts p on p.id = pe.post_id and p.deleted_at is null
    where pe.asset_id in ${liveAlbumAssetIds(albumId)} and pe.deleted_at is null)`;
}

/** When the asset was last posted: `null` for never. */
export const lastPostedAt = sql`(select max(p.posted_at) from post_assets pe join posts p on p.id = pe.post_id where pe.asset_id = a.id and pe.deleted_at is null and p.deleted_at is null)`;

/** The assets a scope keeps by their deletion: Deleted the trashed, a post all but the purged, the others the live. */
export function assetDeletionWhere(scope: AssetScope): SQL {
  if (scope === 'deleted') return sql`a.deleted_at is not null and a.purged_at is null`;
  if (isPostScope(scope)) return sql`a.purged_at is null`;
  return sql`a.deleted_at is null`;
}

/** The assets of a scope: through its edges when they drive the read (scopeEdges), else an album's membership. */
export function assetScopeWhere(scope: AssetScope, sort = 'createdAt:desc'): SQL {
  const deletion = assetDeletionWhere(scope);
  const edges = scopeEdges(scope, sort);
  if (edges) return sql`${deletion} and ${edges.where}`;
  if (scope === 'favorites') return sql`${deletion} and a.is_favorite = 1`;
  if (typeof scope === 'object' && 'assetId' in scope) return sql`${deletion} and a.id = ${scope.assetId}`;
  if (typeof scope !== 'object' || !('albumId' in scope)) return deletion;
  return sql`${deletion} and a.id in ${liveAlbumAssetIds(scope.albumId)}`;
}

/**
 * The order of a scope's assets, ending with an id tie-break so refreshes and pages see one order.
 * The Deleted scope has no sort menu and lists the most recently deleted first; a post has no sort
 * either and lists in its own order.
 */
export function assetOrder(scope: AssetScope, sort = 'createdAt:desc'): SQL {
  if (scope === 'deleted') return sql`a.deleted_at desc, a.id desc`;
  if (scopeEdges(scope, sort)) return sql`e.position, e.id`;
  if (sort === 'random') return sql`random()`;
  const direction = sql.raw(sort.endsWith(':asc') ? 'asc' : 'desc');
  return sql`a.created_at ${direction}, a.id ${direction}`;
}
