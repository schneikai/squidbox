import { and, asc, count, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import {
  a,
  assetOrder,
  assetScopeWhere,
  fromScope,
  liveAlbumAssetIds,
  placeInPost,
  postAlbumAssetIds,
  scopeEdges,
} from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import { inJson } from '@/sync/inJson';
import { matchingIds } from '@/sync/matchingIds';
import { readThreadPosts } from '@/sync/postThreads';
import { repostDate } from '@/sync/postsRepository';

const p = alias(schema.posts, 'p');

/**
 * What a post list shows, as SQL: `read(db, { limit })` → `{ rows, count }` from one transaction
 * (no `limit` reads them all; `withCount: false` skips the count, for a read of one post),
 * each row a post with `postAssets: [{ id, asset }]` (its live edges in order, one per asset, a
 * deleted asset included; `firstAssetOnly` reads just the first, e.g. for a thumbnail) and
 * `threadCount` (its live following posts); `tables` → what a live read watches.
 * A thread is its first post: lists, counts and searches leave its following posts out (a search or
 * a photo found in one finds the thread), but a following post whose first post is deleted is a post
 * of its own. The `{ postId }` scope reads that exact post, with `threadPosts` (its following posts
 * in order, each with its `postAssets`).
 * Every order ends with an id tie-break, so refreshes and pages see one stable order.
 * @param {object} descriptor
 * @param {'all' | 'repostCandidates' | 'ignored' | { assetId: string } | { albumId: string } | { postId: string } | { sharesAlbumWithPostId: string }} [descriptor.scope]
 * @param {'postedAt:asc' | 'postedAt:desc' | 'suggestRepostAt:asc' | 'updatedAt:desc'} [descriptor.sort]
 * @param {'favorites'[]} [descriptor.filter]
 * @param {string} [descriptor.search] a text substring, matched as the list did: Unicode-aware, literal, case-insensitive
 */
export default function postQuery({ scope = 'all', sort = 'postedAt:desc', filter = [], search = '' }) {
  const descriptor = { scope, sort, filter, search };
  const searchText = search.trim().toLowerCase();
  const direction = sort.endsWith(':asc') ? asc : desc;

  const tables = [schema.posts, schema.postAssets, schema.assets];
  if (scope.albumId) tables.push(schema.albumAssets);
  if (scope.sharesAlbumWithPostId) tables.push(schema.albumAssets, schema.albums);

  const scopeCondition = (() => {
    if (scope === 'repostCandidates') return and(eq(p.isIgnoredForRepost, false), eq(p.hasBeenReposted, false));
    if (scope === 'ignored') return eq(p.isIgnoredForRepost, true);
    if (scope.postId) return eq(p.id, scope.postId);
    if (scope.assetId) {
      return sql`${p.id} in ${threadsOf(sql`select post_id from post_assets where asset_id = ${scope.assetId} and deleted_at is null`)}`;
    }
    if (scope.albumId) {
      return sql`${p.id} in ${threadsOf(sql`select post_id from post_assets where asset_id in ${liveAlbumAssetIds(scope.albumId)} and deleted_at is null`)}`;
    }
    if (scope.sharesAlbumWithPostId) {
      const postId = scope.sharesAlbumWithPostId;
      return sql`${p.id} != ${postId} and ${p.id} in ${threadsOf(sql`select post_id from post_assets where asset_id in ${postAlbumAssetIds(postId)} and deleted_at is null`)}`;
    }
    return undefined;
  })();
  // A thread is listed as its first post, unless that is deleted (an older build deletes it alone).
  const threadCondition = scope.postId
    ? undefined
    : sql`(${p.threadRootId} is null or not exists (select 1 from posts r where r.id = ${p.threadRootId} and r.deleted_at is null))`;
  const favorites = filter.includes('favorites') ? eq(p.isFavorite, true) : undefined;
  const order = (() => {
    if (sort === 'suggestRepostAt:asc') return [asc(repostDate(p)), asc(p.id)];
    if (sort === 'updatedAt:desc') return [desc(p.updatedAt), desc(p.id)];
    return [direction(p.postedAt), direction(p.id)];
  })();

  // The search runs over every live post's text, once per read for rows and count alike. A hit in a
  // following post finds its thread's first post, while that is live.
  async function matchedIds(tx) {
    if (!searchText) return null;
    const rows = await tx
      .select({ id: p.id, threadRootId: p.threadRootId, text: p.text })
      .from(p)
      .where(isNull(p.deletedAt));
    const live = new Set(rows.map((row) => row.id));
    const rootOf = new Map(rows.map((row) => [row.id, live.has(row.threadRootId) ? row.threadRootId : row.id]));
    return [...new Set(matchingIds(rows, searchText).map((id) => rootOf.get(id)))];
  }
  const where = (ids) =>
    and(isNull(p.deletedAt), threadCondition, scopeCondition, favorites, ids ? inJson(p.id, ids) : undefined);

  // The posts' assets in order, read as the asset screen reads a post's (assetQuery's post scope): a
  // trashed asset still shows (it can come back), a purged one never does (sync-design §7). With
  // `firstAssetOnly`, only each post's first.
  async function readPostAssets(tx, posts, firstAssetOnly) {
    const postIds = posts.map((post) => post.id);
    const postScope = { postId: postIds };
    const { e } = scopeEdges(postScope);
    const edges = firstAssetOnly
      ? await readFirstEdges(tx, postScope)
      : await fromScope(tx.select({ id: e.id, postId: e.postId, asset: a }), postScope)
          .where(assetScopeWhere(postScope))
          .orderBy(e.postId, assetOrder(postScope));
    const byPost = new Map(postIds.map((id) => [id, []]));
    for (const { id, postId, asset } of edges) byPost.get(postId).push({ id, asset });
    return posts.map((post) => ({ ...post, postAssets: byPost.get(post.id) }));
  }

  return {
    descriptor,
    tables,
    read(db, { limit, withCount = true, firstAssetOnly = false }) {
      return db.transaction(async (tx) => {
        const ids = await matchedIds(tx);
        const total = withCount ? (await tx.select({ count: count() }).from(p).where(where(ids)))[0].count : undefined;
        const posts = await tx
          .select({ ...getTableColumns(p), threadCount })
          .from(p)
          .where(where(ids))
          .orderBy(...order)
          .limit(limit);
        if (!scope.postId) return { rows: await readPostAssets(tx, posts, firstAssetOnly), count: total };
        // The post screen and the editor's seed: the post's following posts too, one edge read for all.
        const following = await readThreadPosts(
          tx,
          posts.map((post) => post.id),
        );
        const withAssets = await readPostAssets(tx, [...posts, ...following], firstAssetOnly);
        const rows = withAssets.slice(0, posts.length).map((post) => ({
          ...post,
          threadPosts: withAssets.slice(posts.length).filter((part) => part.threadRootId === post.id),
        }));
        return { rows, count: total };
      });
    },
  };
}

// The live first post of each post `postIds` selects: a following post's thread root, while that is
// live, else the post itself.
function threadsOf(postIds) {
  return sql`(select coalesce(r.id, q.id) from posts q left join posts r on r.id = q.thread_root_id and r.deleted_at is null
    where q.id in (${postIds}))`;
}

// A post's live following posts, counted over posts_thread_idx. `p.id` is spelled out: drizzle
// leaves a selected field's columns unqualified, which inside the subquery would name `c.id`.
const threadCount = sql`(select count(*) from posts c where c.thread_root_id = p.id and c.deleted_at is null)`
  .mapWith(Number)
  .as('thread_count');

// Each post's first edge of its scope (placeInPost), with its asset: one windowed pass over the
// scope's edges, then the asset rows of the first ones only.
function readFirstEdges(tx, postScope) {
  const { e } = scopeEdges(postScope);
  const ranked = fromScope(
    tx.select({ id: e.id, postId: e.postId, assetId: e.assetId, place: placeInPost(postScope).as('place') }),
    postScope,
  )
    .where(assetScopeWhere(postScope))
    .as('ranked');
  return tx
    .select({ id: ranked.id, postId: ranked.postId, asset: a })
    .from(ranked)
    .innerJoin(a, eq(a.id, ranked.assetId))
    .where(eq(ranked.place, 1));
}
