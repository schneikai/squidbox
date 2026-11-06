import { and, count, eq, getTableColumns, isNotNull, not, sql, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  a,
  assetDeletionWhere,
  assetOrder,
  assetScopeWhere,
  fromScope,
  liveAlbumAssetIds,
  type AssetQueryScope,
  type AssetSort,
} from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import type { AssetRow } from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { matchingIds } from '@/sync/matchingIds';
import type { PagedQuery } from '@/sync/usePagedQuery';
import { MEDIA_TYPES } from '@/utils/assets/constants';

export const ASSET_FILTERS = ['favorites', 'images', 'videos'] as const;
export type AssetFilter = (typeof ASSET_FILTERS)[number];

export function isAssetFilter(value: unknown): value is AssetFilter {
  return ASSET_FILTERS.some((filter) => filter === value);
}

/** Assets to leave out, by id or an album's (the asset picker hides what the post or album already holds). */
export type AssetExclude = string[] | { albumId: string };

/**
 * `sort`: `custom` needs an album scope; the Deleted scope has no sort menu and lists the most
 * recently deleted first; a post has no sort either and lists in its own order (filter and search
 * still apply). `search` is a notes substring, matched as the grid did: Unicode-aware, literal,
 * case-insensitive.
 */
export type AssetQueryDescriptor = {
  scope?: AssetQueryScope;
  sort?: AssetSort;
  filter?: AssetFilter[];
  search?: string;
  exclude?: AssetExclude;
};

export type AssetQuery = PagedQuery<AssetRow> & {
  descriptor: Required<AssetQueryDescriptor>;
  ids(db: SyncDb, options?: { limit?: number }): Promise<string[]>;
  rowsByIds(db: SyncDb, ids: string[]): Promise<AssetRow[]>;
};

/**
 * What an asset grid shows, as SQL: `read(db, { limit })` → `{ rows, count }` from one transaction,
 * `ids(db, { limit })` → the matching ids in the same order, `tables` → what a live read watches,
 * `rowsByIds(db, ids)` → those of these assets the scope keeps by their deletion, whether they
 * still match it or not (the asset screen's window). The descriptor is a plain object a screen can
 * pass around. Every order ends with an id tie-break, so refreshes and pages see one stable order.
 */
export default function assetQuery({
  scope = 'library',
  sort = 'createdAt:desc',
  filter = [],
  search = '',
  exclude = [],
}: AssetQueryDescriptor): AssetQuery {
  const isAlbum = typeof scope === 'object' && 'albumId' in scope;
  const isPost = typeof scope === 'object' && 'postId' in scope;
  const isCustom = sort === 'custom';
  if (isCustom && !isAlbum) throw new Error('The custom sort needs an album scope');

  const tables: SQLiteTable[] = [schema.assets];
  if (isAlbum) tables.push(schema.albumAssets);
  if (isPost) tables.push(schema.postAssets);
  if (typeof scope === 'object' && 'contactId' in scope) tables.push(schema.contactLinks);
  if (!Array.isArray(exclude)) tables.push(schema.albumAssets);

  const filterConditions: SQL[] = [];
  if (filter.includes('favorites')) filterConditions.push(eq(a.isFavorite, true));
  if (filter.includes('images')) filterConditions.push(eq(a.mediaType, MEDIA_TYPES.IMAGE));
  if (filter.includes('videos')) filterConditions.push(eq(a.mediaType, MEDIA_TYPES.VIDEO));
  if (!Array.isArray(exclude)) filterConditions.push(sql`a.id not in ${liveAlbumAssetIds(exclude.albumId)}`);
  else if (exclude.length) filterConditions.push(not(inJson(a.id, exclude)));

  // The search runs over the noted rows of the scope, once per read for rows and count alike: a
  // post's few through its edges, any other scope's through the noted assets' index.
  const searchText = search.trim().toLowerCase();
  async function matchedIds(tx: SyncDb): Promise<string[] | null> {
    if (!searchText) return null;
    const select = tx.select({ id: a.id, text: a.notes });
    const noted = await (isPost
      ? from(select).where(and(isNotNull(a.notes), assetScopeWhere(scope, sort)))
      : select.from(a).where(and(isNotNull(a.notes), assetDeletionWhere(scope))));
    return matchingIds(noted, searchText);
  }

  function where(ids: string[] | null) {
    return and(assetScopeWhere(scope, sort), ...filterConditions, ids ? inJson(a.id, ids) : undefined);
  }

  // `query` is a drizzle select builder: fromScope's, typed as it types it.
  function from(query: Parameters<typeof fromScope>[0]) {
    return fromScope(query, scope, sort);
  }

  function ordered(tx: SyncDb, fields: Parameters<SyncDb['select']>[0], ids: string[] | null) {
    return from(tx.select(fields)).where(where(ids)).orderBy(assetOrder(scope, sort));
  }

  return {
    descriptor: { scope, sort, filter, search, exclude },
    tables,
    read(db, { limit }): Promise<{ rows: AssetRow[]; count: number }> {
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
        return rows.map((row: Pick<AssetRow, 'id'>) => row.id);
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
