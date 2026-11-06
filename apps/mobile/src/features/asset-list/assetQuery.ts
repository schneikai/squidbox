import { and, count, eq, getTableColumns, isNotNull, not, sql, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import isOneOf from '@/lib/isOneOf';
import {
  a,
  assetDeletionWhere,
  assetOrder,
  assetScopeWhere,
  fromScope,
  isIdScope,
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

const ASSET_FILTERS = ['favorites', 'images', 'videos'] as const;
export type AssetFilter = (typeof ASSET_FILTERS)[number];

export const isAssetFilter = isOneOf(ASSET_FILTERS);

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
  const isAlbum = isIdScope(scope, 'albumId');
  const isPost = isIdScope(scope, 'postId');
  const isCustom = sort === 'custom';
  if (isCustom && !isAlbum) throw new Error('The custom sort needs an album scope');

  const tables: SQLiteTable[] = [schema.assets];
  if (isAlbum) tables.push(schema.albumAssets);
  if (isPost) tables.push(schema.postAssets);
  if (isIdScope(scope, 'contactId')) tables.push(schema.contactLinks);
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
      ? fromScope(select, scope, sort).where(and(isNotNull(a.notes), assetScopeWhere(scope, sort)))
      : select.from(a).where(and(isNotNull(a.notes), assetDeletionWhere(scope))));
    // isNotNull keeps the noted rows only, which drizzle's types don't know.
    return matchingIds(
      noted.map((row) => ({ id: row.id, text: row.text ?? '' })),
      searchText,
    );
  }

  function where(ids: string[] | null) {
    return and(assetScopeWhere(scope, sort), ...filterConditions, ids ? inJson(a.id, ids) : undefined);
  }

  return {
    descriptor: { scope, sort, filter, search, exclude },
    tables,
    read(db, { limit }): Promise<{ rows: AssetRow[]; count: number }> {
      return db.transaction(async (tx) => {
        const ids = await matchedIds(tx);
        const [{ count: total }] = await fromScope(tx.select({ count: count() }), scope, sort).where(where(ids));
        const rows = await fromScope(tx.select(getTableColumns(a)), scope, sort)
          .where(where(ids))
          .orderBy(assetOrder(scope, sort))
          .limit(limit);
        return { rows, count: total };
      });
    },
    ids(db, { limit } = {}) {
      return db.transaction(async (tx) => {
        const query = fromScope(tx.select({ id: a.id }), scope, sort)
          .where(where(await matchedIds(tx)))
          .orderBy(assetOrder(scope, sort));
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
