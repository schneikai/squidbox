import { and, asc, count, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { a, assetOrder, assetScopeWhere, fromScope, liveAlbumAssetIds, placeInPost, scopeEdges } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import { inJson } from '@/sync/inJson';
import { matchingIds } from '@/sync/matchingIds';
import { repostDate } from '@/sync/postsRepository';

const p = alias(schema.posts, 'p');

/**
 * What a post list shows, as SQL: `read(db, { limit })` → `{ rows, count }` from one transaction
 * (no `limit` reads them all; `withCount: false` skips the count, for a read of one post),
 * each row a post with `postAssets: [{ id, asset }]` (its live edges in order, one per asset, a
 * deleted asset included; `firstAssetOnly` reads just the first, e.g. for a thumbnail);
 * `tables` → what a live read watches.
 * Every order ends with an id tie-break, so refreshes and pages see one stable order.
 * @param {object} descriptor
 * @param {'all' | 'repostCandidates' | 'ignored' | { assetId: string } | { albumId: string } | { postId: string }} [descriptor.scope]
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

  const scopeCondition = (() => {
    if (scope === 'repostCandidates') return and(eq(p.isIgnoredForRepost, false), eq(p.hasBeenReposted, false));
    if (scope === 'ignored') return eq(p.isIgnoredForRepost, true);
    if (scope.postId) return eq(p.id, scope.postId);
    if (scope.assetId) {
      return sql`${p.id} in (select post_id from post_assets where asset_id = ${scope.assetId} and deleted_at is null)`;
    }
    if (scope.albumId) {
      return sql`${p.id} in (select post_id from post_assets where asset_id in ${liveAlbumAssetIds(scope.albumId)} and deleted_at is null)`;
    }
    return undefined;
  })();
  const favorites = filter.includes('favorites') ? eq(p.isFavorite, true) : undefined;
  const order = (() => {
    if (sort === 'suggestRepostAt:asc') return [asc(repostDate(p)), asc(p.id)];
    if (sort === 'updatedAt:desc') return [desc(p.updatedAt), desc(p.id)];
    return [direction(p.postedAt), direction(p.id)];
  })();

  // The search runs over every live post's text, once per read for rows and count alike.
  async function matchedIds(tx) {
    if (!searchText) return null;
    return matchingIds(await tx.select({ id: p.id, text: p.text }).from(p).where(isNull(p.deletedAt)), searchText);
  }
  const where = (ids) => and(isNull(p.deletedAt), scopeCondition, favorites, ids ? inJson(p.id, ids) : undefined);

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
          .select(getTableColumns(p))
          .from(p)
          .where(where(ids))
          .orderBy(...order)
          .limit(limit);
        return { rows: await readPostAssets(tx, posts, firstAssetOnly), count: total };
      });
    },
  };
}

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
