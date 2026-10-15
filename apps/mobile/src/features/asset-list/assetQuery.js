import { and, count, eq, getTableColumns, isNotNull, isNull } from 'drizzle-orm';

import { a, assetOrder, assetScopeWhere, e, lastPostedAt, matchingIds, sortsByLastPostedAt } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import { inJson } from '@/sync/inJson';
import { MEDIA_TYPES } from '@/utils/assets/constants';

/**
 * What an asset grid shows, as SQL: `read(db, { limit })` → `{ rows, count }` from one transaction,
 * `ids(db, { limit })` → the matching ids in the same order, `tables` → what a live read watches.
 * The descriptor is a plain object a screen can pass around. Every order ends with an id tie-break,
 * so refreshes and pages see one stable order.
 * @param {object} descriptor
 * @param {'library' | 'favorites' | 'deleted' | { albumId: string }} [descriptor.scope]
 * @param {'createdAt:asc' | 'createdAt:desc' | 'lastPostedAt:asc' | 'lastPostedAt:desc' | 'custom' | 'random'} [descriptor.sort]
 *   `custom` needs an album scope; the Deleted scope has no sort menu and lists the most recently deleted first
 * @param {('favorites' | 'images' | 'videos')[]} [descriptor.filter]
 * @param {string} [descriptor.search] a notes substring, matched as the grid did: Unicode-aware, literal, case-insensitive
 */
export default function assetQuery({ scope = 'library', sort = 'createdAt:desc', filter = [], search = '' }) {
  const isCustom = sort === 'custom';
  if (isCustom && !scope.albumId) throw new Error('The custom sort needs an album scope');
  const isByLastPosted = sortsByLastPostedAt(scope, sort);

  const tables = [schema.assets];
  if (scope.albumId) tables.push(schema.albumAssets);
  if (isByLastPosted) tables.push(schema.postAssets, schema.posts);

  const filterConditions = [];
  if (filter.includes('favorites')) filterConditions.push(eq(a.isFavorite, true));
  if (filter.includes('images')) filterConditions.push(eq(a.mediaType, MEDIA_TYPES.IMAGE));
  if (filter.includes('videos')) filterConditions.push(eq(a.mediaType, MEDIA_TYPES.VIDEO));

  // The search runs over the noted rows of the scope, once per read for rows and count alike.
  const searchText = search.trim().toLowerCase();
  async function matchedIds(tx) {
    if (!searchText) return null;
    const noted = await tx
      .select({ id: a.id, text: a.notes })
      .from(a)
      .where(and(isNotNull(a.notes), scope === 'deleted' ? isNotNull(a.deletedAt) : isNull(a.deletedAt)));
    return matchingIds(noted, searchText);
  }

  function where(ids) {
    return and(assetScopeWhere(scope, sort), ...filterConditions, ids ? inJson(a.id, ids) : undefined);
  }

  function from(query) {
    return isCustom ? query.from(e).innerJoin(a, eq(a.id, e.assetId)) : query.from(a);
  }

  function ordered(tx, fields, ids) {
    const selected = isByLastPosted ? { ...fields, lastPostedAt: lastPostedAt.as('last_posted_at') } : fields;
    return from(tx.select(selected)).where(where(ids)).orderBy(assetOrder(scope, sort));
  }

  return {
    descriptor: { scope, sort, filter, search },
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
        const query = ordered(tx, { id: a.id, createdAt: a.createdAt }, await matchedIds(tx));
        const rows = await (limit === undefined ? query : query.limit(limit));
        return rows.map((row) => row.id);
      });
    },
  };
}
