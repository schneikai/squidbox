import { and, asc, count, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { alias, type SQLiteTable } from 'drizzle-orm/sqlite-core';

import threadCount from './threadCount';
import withPostAssets from './withPostAssets';

import { contactPhotoIds, contactTargetIds, isIdScope, liveAlbumAssetIds, postAlbumAssetIds } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import type { AssetRow, PostRow } from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { matchingIds } from '@/sync/matchingIds';
import { isListedPost, listedPostId, postsHoldingAssets, repostDate } from '@/sync/postsRepository';
import type { PagedQuery } from '@/sync/usePagedQuery';
import type { PostAsset } from '@/utils/posts/buildPostAsset';

const p = alias(schema.posts, 'p');

/** Which posts a list shows (a contact's: the posts it is on, and those holding a photo it is on). */
export type PostQueryScope =
  | 'all'
  | 'repostCandidates'
  | 'ignored'
  | { assetId: string }
  | { albumId: string }
  | { postId: string }
  | { sharesAlbumWithPostId: string }
  | { contactId: string };

export type PostSort = 'postedAt:asc' | 'postedAt:desc' | 'suggestRepostAt:asc' | 'updatedAt:desc';

/** `search` is a text substring, matched as the list did: Unicode-aware, literal, case-insensitive. */
export type PostQueryDescriptor = { scope?: PostQueryScope; sort?: PostSort; search?: string };

/** A post with its assets in order. */
export type PostWithAssets = PostRow & { postAssets: PostAsset<AssetRow>[] };

/** A row of a post list: the post with its assets and its live following posts' count. */
export type PostListRow = PostWithAssets & { threadCount: number };

type ReadOptions = { limit?: number; firstAssetOnly?: boolean };

/** A paged query of post rows whose reads also take `firstAssetOnly`; `readRows` skips the count. */
export type PostQuery = PagedQuery<PostListRow> & {
  descriptor: Required<PostQueryDescriptor>;
  read(db: SyncDb, options?: ReadOptions): Promise<{ rows: PostListRow[]; count: number }>;
  readRows(db: SyncDb, options?: ReadOptions): Promise<PostListRow[]>;
};

/**
 * What a post list shows, as SQL: `read(db, { limit })` → `{ rows, count }` from one transaction
 * (no `limit` reads them all), `readRows(db, { limit })` → the rows alone,
 * each row a post with `postAssets: [{ id, asset }]` (its live edges in order, one per asset, a
 * deleted asset included; `firstAssetOnly` reads just the first, e.g. for a thumbnail) and
 * `threadCount` (its live following posts); `tables` → what a live read watches.
 * A thread is its first post: lists, counts and searches leave its following posts out (a search or
 * a photo found in one finds the thread), but a following post whose first post is deleted is a post
 * of its own.
 * Every order ends with an id tie-break, so refreshes and pages see one stable order.
 */
export default function postQuery({
  scope = 'all',
  sort = 'postedAt:desc',
  search = '',
}: PostQueryDescriptor): PostQuery {
  const descriptor = { scope, sort, search };
  const searchText = search.trim().toLowerCase();
  const direction = sort.endsWith(':asc') ? asc : desc;

  const tables: SQLiteTable[] = [schema.posts, schema.postAssets, schema.assets];
  if (isIdScope(scope, 'albumId')) tables.push(schema.albumAssets);
  if (isIdScope(scope, 'sharesAlbumWithPostId')) tables.push(schema.albumAssets, schema.albums);
  if (isIdScope(scope, 'contactId')) tables.push(schema.contactLinks);

  const scopeCondition = (() => {
    if (scope === 'repostCandidates') return and(eq(p.isIgnoredForRepost, false), eq(p.hasBeenReposted, false));
    if (scope === 'ignored') return eq(p.isIgnoredForRepost, true);
    if (isIdScope(scope, 'postId')) return eq(p.id, scope.postId);
    if (isIdScope(scope, 'contactId')) {
      // The posts it is on, and those holding a photo it is on.
      const { contactId } = scope;
      return sql`(${p.id} in ${contactTargetIds(contactId, 'post')} or ${p.id} in ${postsHoldingAssets(sql`asset_id in ${contactPhotoIds(contactId)}`)})`;
    }
    if (isIdScope(scope, 'assetId')) return sql`${p.id} in ${postsHoldingAssets(sql`asset_id = ${scope.assetId}`)}`;
    if (isIdScope(scope, 'albumId')) {
      return sql`${p.id} in ${postsHoldingAssets(sql`asset_id in ${liveAlbumAssetIds(scope.albumId)}`)}`;
    }
    if (isIdScope(scope, 'sharesAlbumWithPostId')) {
      const postId = scope.sharesAlbumWithPostId;
      return sql`${p.id} != ${postId} and ${p.id} in ${postsHoldingAssets(sql`asset_id in ${postAlbumAssetIds(postId)}`)}`;
    }
    return undefined;
  })();
  // The scopes above and the search pick listed posts already; the plain lists check each post.
  const threadCondition = typeof scope === 'string' ? isListedPost('p') : undefined;
  const order = (() => {
    if (sort === 'suggestRepostAt:asc') return [asc(repostDate(p)), asc(p.id)];
    if (sort === 'updatedAt:desc') return [desc(p.updatedAt), desc(p.id)];
    return [direction(p.postedAt), direction(p.id)];
  })();

  // The search runs over every live post's text, once per read for rows and count alike. A hit in a
  // following post finds the post it is listed as (listedPostId).
  async function matchedIds(tx: SyncDb): Promise<string[] | null> {
    if (!searchText) return null;
    const rows = await tx
      .select({ id: listedPostId('p'), text: p.text })
      .from(p)
      .where(isNull(p.deletedAt));
    return [...new Set(matchingIds(rows, searchText))];
  }
  const where = (ids: string[] | null) =>
    and(isNull(p.deletedAt), threadCondition, scopeCondition, ids ? inJson(p.id, ids) : undefined);

  async function readCount(tx: SyncDb, ids: string[] | null): Promise<number> {
    const [row] = await tx.select({ count: count() }).from(p).where(where(ids));
    return row?.count ?? 0;
  }

  // The posts matching `ids` (all without a search), without their assets, in `tx`.
  function postsMatching(tx: SyncDb, ids: string[] | null, limit: number | undefined) {
    const select = tx
      .select({ ...getTableColumns(p), threadCount })
      .from(p)
      .where(where(ids))
      .orderBy(...order);
    // No `limit` reads them all (drizzle's `limit` takes a number).
    return limit === undefined ? select : select.limit(limit);
  }

  return {
    descriptor,
    tables,
    read(db, options: ReadOptions = {}) {
      return db.transaction(async (tx) => {
        const ids = await matchedIds(tx);
        const total = await readCount(tx, ids);
        const posts = await postsMatching(tx, ids, options.limit);
        return { rows: await withPostAssets(tx, posts, options.firstAssetOnly), count: total };
      });
    },
    readRows(db, options: ReadOptions = {}) {
      return db.transaction(async (tx) =>
        withPostAssets(tx, await postsMatching(tx, await matchedIds(tx), options.limit), options.firstAssetOnly),
      );
    },
  };
}
