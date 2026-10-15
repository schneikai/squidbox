import { and, asc, count, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { liveAlbumAssetIds } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import { isCanonicalEdge } from '@/sync/edgeSql';
import { inJson } from '@/sync/inJson';
import { matchingIds } from '@/sync/matchingIds';
import { repostDate } from '@/sync/postsRepository';
import { readByIdMap } from '@/sync/readByIds';

const p = alias(schema.posts, 'p');
const e = alias(schema.postAssets, 'e');

/**
 * What a post list shows, as SQL: `read(db, { limit })` → `{ rows, count }` from one transaction
 * (`withCount: false` skips the count, for a read of one post),
 * each row a post with `postAssets: [{ id, asset }]` (its live edges in order, one per asset, the
 * asset rows read by id so a deleted asset still shows); `tables` → what a live read watches.
 * An `asset:<id>` or `album:<id>` search becomes that scope, as the posts screen always read it.
 * Every order ends with an id tie-break, so refreshes and pages see one stable order.
 * @param {object} descriptor
 * @param {'all' | 'repostCandidates' | 'ignored' | { assetId: string } | { albumId: string } | { postId: string }} [descriptor.scope]
 * @param {'postedAt:asc' | 'postedAt:desc' | 'suggestRepostAt:asc' | 'updatedAt:desc'} [descriptor.sort]
 * @param {'favorites'[]} [descriptor.filter]
 * @param {string} [descriptor.search] a text substring, matched as the list did: Unicode-aware, literal, case-insensitive
 */
export default function postQuery({ scope = 'all', sort = 'postedAt:desc', filter = [], search = '' }) {
  const descriptor = { scope, sort, filter, search };
  const scoped = search.match(/(asset|album):(\S+)/i);
  if (scoped) scope = scoped[1].toLowerCase() === 'asset' ? { assetId: scoped[2] } : { albumId: scoped[2] };
  const searchText = scoped ? '' : search.trim().toLowerCase();
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

  // The posts' live edges, one per asset (the earliest by position), in order.
  async function readPostAssets(tx, posts) {
    const postIds = posts.map((post) => post.id);
    const edges = await tx
      .select({ id: e.id, postId: e.postId, assetId: e.assetId })
      .from(e)
      .where(and(inJson(e.postId, postIds), isNull(e.deletedAt), isCanonicalEdge(schema.postAssets, e, 'postId')))
      .orderBy(e.postId, e.position, e.id);
    const assets = await readByIdMap(
      tx,
      schema.assets,
      edges.map((edge) => edge.assetId),
    );
    const byPost = new Map(postIds.map((id) => [id, []]));
    for (const edge of edges) {
      const asset = assets.get(edge.assetId);
      if (asset) byPost.get(edge.postId).push({ id: edge.id, asset });
    }
    return posts.map((post) => ({ ...post, postAssets: byPost.get(post.id) }));
  }

  return {
    descriptor,
    tables,
    read(db, { limit, withCount = true }) {
      return db.transaction(async (tx) => {
        const ids = await matchedIds(tx);
        const total = withCount ? (await tx.select({ count: count() }).from(p).where(where(ids)))[0].count : undefined;
        const posts = await tx
          .select(getTableColumns(p))
          .from(p)
          .where(where(ids))
          .orderBy(...order)
          .limit(limit);
        return { rows: await readPostAssets(tx, posts), count: total };
      });
    },
  };
}
