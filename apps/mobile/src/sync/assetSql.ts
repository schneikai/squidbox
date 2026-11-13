import { eq, sql, type SQL } from 'drizzle-orm';
import { alias, type SelectedFields, type SQLiteColumn, type SQLiteSelectBuilder } from 'drizzle-orm/sqlite-core';

import * as schema from './db/schema';
import { isCanonicalEdge } from './edgeSql';
import { inJson } from './inJson';

import isOneOf from '@/lib/isOneOf';

// The SQL an asset scope is read with, shared by the asset grids (assetQuery), the album list's stats
// (albumQuery) and the post lists (postQuery), so a grid, its count, its album's cover and a post's
// assets agree. It is written over fixed names, `a` for the assets and `e` for the edges when they
// drive the read (scopeEdges), and mostly as raw SQL: drizzle strips the table from every column of
// a single-table selection, `a.id` included.
export const a = alias(schema.assets, 'a');

// How a grid orders its assets (assetQuery's `sort`): `custom` is an album's own order.
const ASSET_SORTS = ['createdAt:asc', 'createdAt:desc', 'custom', 'random'] as const;
export type AssetSort = (typeof ASSET_SORTS)[number];

export const isAssetSort = isOneOf(ASSET_SORTS);

/**
 * An asset scope as a grid shows it (assetQuery's `scope`): the library, a smart album (Deleted: not
 * the purged), an album by id, a post's assets as the post screen shows them, in its order, a
 * trashed one included, or one live asset alone (a post suggestion's), or the live assets a contact
 * is on.
 */
export type AssetQueryScope =
  | 'library'
  | 'favorites'
  | 'deleted'
  | { albumId: string }
  | { postId: string }
  | { assetId: string }
  | { contactId: string };

/**
 * An asset scope as the SQL reads it: a grid's, or an album by SQL naming a column, or several
 * posts' assets (postQuery reads its posts' assets at once).
 */
export type AssetScope = AssetQueryScope | { albumId: SQL } | { postId: string[] };

// A post scope: one post's assets or several posts'.
type PostScope = Extract<AssetScope, { postId: unknown }>;

/** Whether `scope` (an asset or a post scope) is an id scope of `key`: `{ albumId }`, `{ postId }`, … */
export function isIdScope<Scope, Key extends string>(
  scope: Scope,
  key: Key,
): scope is Extract<Scope, Record<Key, unknown>> {
  return typeof scope === 'object' && scope !== null && key in scope;
}

const albumEdge = alias(schema.albumAssets, 'e');
const postEdge = alias(schema.postAssets, 'e');

/** The edges that drive a post scope's read: its posts' live edges, one canonical edge per asset. */
export function postScopeEdges(scope: PostScope) {
  const parent = sql.raw('e.post_id');
  const isOfPost = Array.isArray(scope.postId) ? inJson(parent, scope.postId) : sql`${parent} = ${scope.postId}`;
  return {
    e: postEdge,
    where: sql`${isOfPost} and e.deleted_at is null and ${isCanonicalEdge(schema.postAssets, postEdge, 'postId')}`,
  };
}

/**
 * The edges that drive a scope's read, or `null`: a post's always (postScopeEdges), an album's under
 * the custom order. `e` joins `a` (fromScope), and `where` keeps the parents' live edges, one
 * canonical edge per asset.
 */
export function scopeEdges(scope: AssetScope, sort: AssetSort = 'createdAt:desc') {
  if (isIdScope(scope, 'postId')) return postScopeEdges(scope);
  if (!isIdScope(scope, 'albumId') || sort !== 'custom') return null;
  return {
    e: albumEdge,
    where: sql`e.album_id = ${scope.albumId} and e.deleted_at is null and ${isCanonicalEdge(schema.albumAssets, albumEdge, 'albumId')}`,
  };
}

/**
 * In a post scope over several posts, an asset's place in its post (1 for the first), in the post's
 * order (assetOrder), over the edges the scope keeps: select it in a subquery and keep 1.
 */
export function placeInPost(scope: PostScope): SQL<number> {
  return sql<number>`row_number() over (partition by ${postEdge.postId} order by ${assetOrder(scope)})`;
}

/** A drizzle `select` from the scope's assets: `a`, joined from its edges when they drive the read. */
export function fromScope<
  Selection extends SelectedFields,
  Mode extends 'sync' | 'async',
  Run,
  Builder extends 'db' | 'qb',
>(select: SQLiteSelectBuilder<Selection, Mode, Run, Builder>, scope: AssetScope, sort: AssetSort = 'createdAt:desc') {
  const edges = scopeEdges(scope, sort);
  if (!edges) return select.from(a);
  // Typed as the read from `a` alone: an inner join of explicit fields reads the same rows' shape,
  // and one type lets the callers chain the same calls on either.
  return select.from(edges.e).innerJoin(a, eq(a.id, edges.e.assetId)) as unknown as ReturnType<
    typeof select.from<typeof a>
  >;
}

/** The ids of an album's assets, through its live edges. */
export function liveAlbumAssetIds(albumId: string | SQL): SQL {
  return sql`(select asset_id from album_assets where album_id = ${albumId} and deleted_at is null)`;
}

/**
 * The ids of the posts shown as the post `postId` (sync-design §10): itself, and the live ones of its
 * following posts, its other channels and their following posts. Each part goes through an index.
 */
export function postFamilyIds(postId: string): SQL {
  return sql`(select ${postId}
    union all select id from posts where thread_root_id = ${postId} and deleted_at is null
    union all select id from posts where channel_root_id = ${postId} and deleted_at is null
    union all select f.id from posts c join posts f on f.thread_root_id = c.id and f.deleted_at is null
      where c.channel_root_id = ${postId} and c.deleted_at is null)`;
}

/** The ids of the assets of a post, its thread and its other channels (postFamilyIds), through live edges. */
export function postFamilyAssetIds(postId: string): SQL {
  return sql`(select asset_id from post_assets where deleted_at is null and post_id in ${postFamilyIds(postId)})`;
}

/** Whether the album `albumId` (a column, or an id) holds any of these assets, through a live edge. */
export function albumHoldsAny(albumId: string | SQL | SQLiteColumn, assetIds: string[]): SQL {
  return sql`exists (select 1 from album_assets where album_id = ${albumId} and deleted_at is null and ${inJson(sql.raw('asset_id'), assetIds)})`;
}

/** An album's photos, or a post's (with its thread's and its other channels'). */
export type PhotosOf = { albumId: string } | { postId: string };

/** The ids of the live, untrashed photos of an album or post (PhotosOf), through live edges. */
export function livePhotoIdsOf(of: PhotosOf): SQL {
  return sql`(select id from assets where deleted_at is null and id in ${heldPhotoIds(of)})`;
}

/** The ids of an album's or post's photos (PhotosOf), trashed ones included, through live edges. */
export function heldPhotoIds(of: PhotosOf): SQL {
  return 'albumId' in of ? liveAlbumAssetIds(of.albumId) : postFamilyAssetIds(of.postId);
}

/** The ids of the live, untrashed photos a contact (or any of several) is on, through its live links. */
export function contactPhotoIds(contactIds: string | string[]): SQL {
  return sql`(select l.target_id from contact_links l join assets a on a.id = l.target_id and a.deleted_at is null
    where ${contactPhotoLinks(contactIds)})`;
}

/**
 * The ids of the photos any of these contacts is on, trashed ones included, through their live links:
 * a scope that shows trashed photos (Deleted, a post) keeps its own by their deletion.
 */
export function contactLinkedPhotoIds(contactIds: string[]): SQL {
  return sql`(select l.target_id from contact_links l where ${contactPhotoLinks(contactIds)})`;
}

/** The ids of the albums holding a live photo a contact (or any of several) is on, through live edges. */
export function contactAlbumIds(contactIds: string | string[]): SQL {
  return sql`(select album_id from album_assets where ${contactAlbumEdges(contactIds)})`;
}

/** The live `album_assets` edges to a live photo a contact (or any of several) is on, as a WHERE over that table. */
export function contactAlbumEdges(contactIds: string | string[]): SQL {
  return sql`deleted_at is null and asset_id in ${contactPhotoIds(contactIds)}`;
}

// The live links `l` of these contacts to photos.
function contactPhotoLinks(contactIds: string | string[]): SQL {
  const contact = sql.raw('l.contact_id');
  const isOfContacts = Array.isArray(contactIds) ? inJson(contact, contactIds) : sql`${contact} = ${contactIds}`;
  return sql`${isOfContacts} and l.target_type = 'asset' and l.deleted_at is null`;
}

/**
 * The ids of the assets of a post's live albums (the albums holding any of the assets the post
 * screen shows, its thread's and its other channels' included (postFamilyIds), so not the purged),
 * through live edges. A trashed asset of those albums counts, as in an album's Posts tab
 * (liveAlbumAssetIds), though the album's grid hides it.
 */
export function postAlbumAssetIds(postId: string): SQL {
  return albumAssetIdsOf(sql`(select pe.asset_id from post_assets pe join assets pa on pa.id = pe.asset_id and pa.purged_at is null
    where pe.deleted_at is null and pe.post_id in ${postFamilyIds(postId)})`);
}

/**
 * The ids of the assets of the live albums holding any of these assets (a list, or SQL selecting
 * asset ids), through live edges.
 */
export function albumAssetIdsOf(assetIds: string[] | SQL): SQL {
  const isOfAssets = Array.isArray(assetIds) ? inJson(sql.raw('asset_id'), assetIds) : sql`asset_id in ${assetIds}`;
  return sql`(select aa.asset_id from album_assets aa join albums al on al.id = aa.album_id and al.deleted_at is null
    where aa.deleted_at is null and aa.album_id in (
      select album_id from album_assets where deleted_at is null and ${isOfAssets}))`;
}

/** When any of an album's assets was last posted, through its live edges: `null` for never. */
export function albumLastPostedAt(albumId: string | SQL): SQL<number | null> {
  return sql`(select max(p.posted_at) from post_assets pe join posts p on p.id = pe.post_id and p.deleted_at is null
    where pe.asset_id in ${liveAlbumAssetIds(albumId)} and pe.deleted_at is null)`;
}

/** The assets a scope keeps by their deletion: Deleted the trashed, a post all but the purged, the others the live. */
export function assetDeletionWhere(scope: AssetScope): SQL {
  if (scope === 'deleted') return sql`a.deleted_at is not null and a.purged_at is null`;
  if (isIdScope(scope, 'postId')) return sql`a.purged_at is null`;
  return sql`a.deleted_at is null`;
}

/** The assets of a scope: through its edges when they drive the read (scopeEdges), else an album's membership. */
export function assetScopeWhere(scope: AssetScope, sort: AssetSort = 'createdAt:desc'): SQL {
  const deletion = assetDeletionWhere(scope);
  const edges = scopeEdges(scope, sort);
  if (edges) return sql`${deletion} and ${edges.where}`;
  if (scope === 'favorites') return sql`${deletion} and a.is_favorite = 1`;
  if (isIdScope(scope, 'assetId')) return sql`${deletion} and a.id = ${scope.assetId}`;
  if (isIdScope(scope, 'contactId')) return sql`${deletion} and a.id in ${contactPhotoIds(scope.contactId)}`;
  if (!isIdScope(scope, 'albumId')) return deletion;
  return sql`${deletion} and a.id in ${liveAlbumAssetIds(scope.albumId)}`;
}

/**
 * The order of a scope's assets, ending with an id tie-break so refreshes and pages see one order.
 * The Deleted scope has no sort menu and lists the most recently deleted first; a post has no sort
 * either and lists in its own order.
 */
export function assetOrder(scope: AssetScope, sort: AssetSort = 'createdAt:desc'): SQL {
  if (scope === 'deleted') return sql`a.deleted_at desc, a.id desc`;
  if (scopeEdges(scope, sort)) return sql`e.position, e.id`;
  if (sort === 'random') return sql`random()`;
  const direction = sql.raw(sort.endsWith(':asc') ? 'asc' : 'desc');
  return sql`a.created_at ${direction}, a.id ${direction}`;
}
