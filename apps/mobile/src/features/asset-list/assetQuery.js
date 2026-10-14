import { and, asc, count, desc, eq, getTableColumns, isNotNull, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import * as schema from '@/sync/db/schema';
import { isCanonicalEdge } from '@/sync/edgeSql';
import { MEDIA_TYPES } from '@/utils/assets/constants';

const a = alias(schema.assets, 'a');
const e = alias(schema.albumAssets, 'e');

// Only for the lastPostedAt sort: the sort key is computed once per row in a derived table and the
// outer ORDER BY reads it. SQLite orders NULL first ascending and last descending, as the grid did.
// Raw SQL: drizzle strips the table from every column of a single-table selection, `a.id` included.
const lastPostedAt = sql.raw(
  '(select max(p.posted_at) from post_assets pe join posts p on p.id = pe.post_id where pe.asset_id = a.id and pe.deleted_at is null and p.deleted_at is null)',
);

/**
 * What an asset grid shows, as SQL: `read(db, { limit })` → `{ rows, count }` from one transaction,
 * `ids(db)` → every matching id in the same order, `tables` → what a live read watches. The
 * descriptor is a plain object a screen can pass around. Every order ends with an id tie-break, so
 * refreshes and pages see one stable order.
 * @param {object} descriptor
 * @param {'library' | 'favorites' | 'deleted' | { albumId: string }} [descriptor.scope]
 * @param {'createdAt:asc' | 'createdAt:desc' | 'lastPostedAt:asc' | 'lastPostedAt:desc' | 'custom' | 'random'} [descriptor.sort]
 *   `custom` needs an album scope; the Deleted scope has no sort menu and lists the most recently deleted first
 * @param {('favorites' | 'images' | 'videos')[]} [descriptor.filter]
 * @param {string} [descriptor.search] a notes substring, matched as the grid did: Unicode-aware, literal, case-insensitive
 */
export default function assetQuery({ scope = 'library', sort = 'createdAt:desc', filter = [], search = '' }) {
  const albumId = scope.albumId;
  const isCustom = sort === 'custom';
  if (isCustom && !albumId) throw new Error('The custom sort needs an album scope');
  const direction = sort.endsWith(':asc') ? asc : desc;

  const tables = [schema.assets];
  if (albumId) tables.push(schema.albumAssets);
  if (sort.startsWith('lastPostedAt')) tables.push(schema.postAssets, schema.posts);

  const scopeCondition = (() => {
    if (scope === 'favorites') return and(isNull(a.deletedAt), eq(a.isFavorite, true));
    if (scope === 'deleted') return isNotNull(a.deletedAt);
    if (isCustom)
      return and(
        isNull(a.deletedAt),
        eq(e.albumId, albumId),
        isNull(e.deletedAt),
        isCanonicalEdge(schema.albumAssets, e, 'albumId'),
      );
    if (albumId)
      return and(
        isNull(a.deletedAt),
        sql`${a.id} in (select ${schema.albumAssets.assetId} from ${schema.albumAssets} where ${schema.albumAssets.albumId} = ${albumId} and ${schema.albumAssets.deletedAt} is null)`,
      );
    return isNull(a.deletedAt);
  })();
  const filterConditions = [];
  if (filter.includes('favorites')) filterConditions.push(eq(a.isFavorite, true));
  if (filter.includes('images')) filterConditions.push(eq(a.mediaType, MEDIA_TYPES.IMAGE));
  if (filter.includes('videos')) filterConditions.push(eq(a.mediaType, MEDIA_TYPES.VIDEO));

  const order = (() => {
    if (scope === 'deleted') return [desc(a.deletedAt), desc(a.id)];
    if (isCustom) return [asc(e.position), asc(e.id)];
    if (sort === 'random') return [sql`random()`];
    return [direction(a.createdAt), direction(a.id)];
  })();

  // The search runs in JS (SQLite's LIKE and lower() fold ASCII only and read % and _ as wildcards)
  // over the noted rows of the scope, once per read for rows and count alike; SQL takes the ids.
  const searchText = search.trim().toLowerCase();
  async function matchedIds(tx) {
    if (!searchText) return null;
    const noted = await tx
      .select({ id: a.id, notes: a.notes })
      .from(a)
      .where(and(isNotNull(a.notes), scope === 'deleted' ? isNotNull(a.deletedAt) : isNull(a.deletedAt)));
    return noted.filter((row) => row.notes.toLowerCase().includes(searchText)).map((row) => row.id);
  }

  function where(ids) {
    const inMatched = ids ? sql`${a.id} in (select value from json_each(${JSON.stringify(ids)}))` : undefined;
    return and(scopeCondition, ...filterConditions, inMatched);
  }

  function from(query) {
    return isCustom ? query.from(e).innerJoin(a, eq(a.id, e.assetId)) : query.from(a);
  }

  function ordered(tx, fields, ids) {
    if (!sort.startsWith('lastPostedAt'))
      return from(tx.select(fields))
        .where(where(ids))
        .orderBy(...order);
    const ranked = from(tx.select({ ...fields, lastPostedAt: lastPostedAt.as('last_posted_at') }))
      .where(where(ids))
      .as('ranked');
    return tx
      .select()
      .from(ranked)
      .orderBy(direction(ranked.lastPostedAt), direction(ranked.createdAt), direction(ranked.id));
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
    ids(db) {
      return db.transaction(async (tx) => {
        const rows = await ordered(tx, { id: a.id, createdAt: a.createdAt }, await matchedIds(tx));
        return rows.map((row) => row.id);
      });
    },
  };
}
