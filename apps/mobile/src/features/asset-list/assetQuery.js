import { and, count, eq, getTableColumns, isNotNull, not, sql } from 'drizzle-orm';

import {
  a,
  assetDeletionWhere,
  assetOrder,
  assetScopeWhere,
  fromScope,
  liveAlbumAssetIds,
} from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import { inJson } from '@/sync/inJson';
import { matchingIds } from '@/sync/matchingIds';
import { MEDIA_TYPES } from '@/utils/assets/constants';

/**
 * What an asset grid shows, as SQL: `read(db, { limit })` → `{ rows, count }` from one transaction,
 * `ids(db, { limit })` → the matching ids in the same order, `tables` → what a live read watches,
 * `rowsByIds(db, ids)` → those of these assets the scope keeps by their deletion, whether they
 * still match it or not (the asset screen's window). The descriptor is a plain object a screen can
 * pass around. Every order ends with an id tie-break, so refreshes and pages see one stable order.
 * @param {object} descriptor
 * @param {'library' | 'favorites' | 'deleted' | { albumId: string } | { postId: string } | { assetId: string }} [descriptor.scope]
 *   a post or one asset: see AssetScope
 * @param {'createdAt:asc' | 'createdAt:desc' | 'custom' | 'random'} [descriptor.sort]
 *   `custom` needs an album scope; the Deleted scope has no sort menu and lists the most recently
 *   deleted first; a post has no sort either and lists in its own order (filter and search still apply)
 * @param {('favorites' | 'images' | 'videos')[]} [descriptor.filter]
 * @param {string} [descriptor.search] a notes substring, matched as the grid did: Unicode-aware, literal, case-insensitive
 * @param {string[] | { albumId: string }} [descriptor.exclude] assets to leave out, by id or an album's
 *   (the asset picker hides what the post or album already holds)
 */
export default function assetQuery({
  scope = 'library',
  sort = 'createdAt:desc',
  filter = [],
  search = '',
  exclude = [],
}) {
  const isCustom = sort === 'custom';
  if (isCustom && !scope.albumId) throw new Error('The custom sort needs an album scope');

  const tables = [schema.assets];
  if (scope.albumId) tables.push(schema.albumAssets);
  if (scope.postId) tables.push(schema.postAssets);
  if (exclude.albumId) tables.push(schema.albumAssets);

  const filterConditions = [];
  if (filter.includes('favorites')) filterConditions.push(eq(a.isFavorite, true));
  if (filter.includes('images')) filterConditions.push(eq(a.mediaType, MEDIA_TYPES.IMAGE));
  if (filter.includes('videos')) filterConditions.push(eq(a.mediaType, MEDIA_TYPES.VIDEO));
  if (exclude.albumId) filterConditions.push(sql`a.id not in ${liveAlbumAssetIds(exclude.albumId)}`);
  else if (exclude.length) filterConditions.push(not(inJson(a.id, exclude)));

  // The search runs over the noted rows of the scope, once per read for rows and count alike: a
  // post's few through its edges, any other scope's through the noted assets' index.
  const searchText = search.trim().toLowerCase();
  async function matchedIds(tx) {
    if (!searchText) return null;
    const select = tx.select({ id: a.id, text: a.notes });
    const noted = await (scope.postId
      ? from(select).where(and(isNotNull(a.notes), assetScopeWhere(scope, sort)))
      : select.from(a).where(and(isNotNull(a.notes), assetDeletionWhere(scope))));
    return matchingIds(noted, searchText);
  }

  function where(ids) {
    return and(assetScopeWhere(scope, sort), ...filterConditions, ids ? inJson(a.id, ids) : undefined);
  }

  function from(query) {
    return fromScope(query, scope, sort);
  }

  function ordered(tx, fields, ids) {
    return from(tx.select(fields)).where(where(ids)).orderBy(assetOrder(scope, sort));
  }

  return {
    descriptor: { scope, sort, filter, search, exclude },
    tables,
    read(db, { limit }) {
      return db.transaction(async (tx) => {
        const ids = await matchedIds(tx);
        const [{ count: total }] = await from(tx.select({ count: count() })).where(where(ids));
        const rows = await ordered(tx, getTableColumns(a), ids).limit(limit);
        return { rows, count: total };
      });
    },
    ids(db, { limit } = {}) {
      return db.transaction(async (tx) => {
        const query = ordered(tx, { id: a.id }, await matchedIds(tx));
        const rows = await (limit === undefined ? query : query.limit(limit));
        return rows.map((row) => row.id);
      });
    },
    rowsByIds(db, ids) {
      return db
        .select()
        .from(a)
        .where(and(inJson(a.id, ids), assetDeletionWhere(scope)));
    },
  };
}
