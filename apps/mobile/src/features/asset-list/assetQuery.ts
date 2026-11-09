import { and, count, eq, getTableColumns, not, or, sql, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { matchingContactIds } from '@/features/contact-list/contactQuery';
import isOneOf from '@/lib/isOneOf';
import {
  a,
  assetDeletionWhere,
  assetOrder,
  assetScopeWhere,
  fromScope,
  isIdScope,
  contactLinkedPhotoIds,
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

// The rows the search reads, as assets_search_idx keeps them (with the scope's deletion).
const isSearchable = schema.hasSearchText(a);

const ASSET_FILTERS = ['favorites', 'images', 'videos'] as const;
export type AssetFilter = (typeof ASSET_FILTERS)[number];

export const isAssetFilter = isOneOf(ASSET_FILTERS);

/** Assets to leave out, by id or an album's (the asset picker hides what the post or album already holds). */
export type AssetExclude = string[] | { albumId: string };

/**
 * `sort`: `custom` needs an album scope; the Deleted scope has no sort menu and lists the most
 * recently deleted first; a post has no sort either and lists in its own order (filter and search
 * still apply). `search` is a substring of the notes, the tags or a tagged contact's name, matched
 * as `matchingIds` does.
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
  const searchText = search.trim().toLowerCase();
  if (searchText) {
    if (!tables.includes(schema.contactLinks)) tables.push(schema.contactLinks);
    tables.push(schema.contacts);
  }

  const filterConditions: SQL[] = [];
  if (filter.includes('favorites')) filterConditions.push(eq(a.isFavorite, true));
  if (filter.includes('images')) filterConditions.push(eq(a.mediaType, MEDIA_TYPES.IMAGE));
  if (filter.includes('videos')) filterConditions.push(eq(a.mediaType, MEDIA_TYPES.VIDEO));
  if (!Array.isArray(exclude)) filterConditions.push(sql`a.id not in ${liveAlbumAssetIds(exclude.albumId)}`);
  else if (exclude.length) filterConditions.push(not(inJson(a.id, exclude)));

  // The search, once per read for rows and count alike: the notes and tags of the scope's rows that
  // have them (a post's few through its edges, any other scope's through the covering index
  // assets_search_idx), matched in JS, and the photos of the contacts it finds (matchingContactIds,
  // the Contacts tab's search), by SQL through their links. Once every photo carries tags (todo.md:
  // tagging at upload) that is every live asset, JSON-parsed and folded per keystroke, and the
  // pre-folded search column of docs/paged-reads-plan.md §2 becomes due.
  async function matchedWhere(tx: SyncDb): Promise<SQL | undefined> {
    if (!searchText) return undefined;
    const select = tx.select({ id: a.id, notes: a.notes, tags: a.tags });
    const searchable = await (isPost
      ? fromScope(select, scope, sort).where(and(isSearchable, assetScopeWhere(scope, sort)))
      : select.from(a).where(and(isSearchable, assetDeletionWhere(scope))));
    // One text per line, as contactSearchText: the tags match as words, not as their JSON.
    const rows = searchable.map(({ id, notes, tags }) => ({
      id,
      text: [notes, ...(tags ?? [])].filter(Boolean).join('\n'),
    }));
    const contactIds = await matchingContactIds(tx, searchText);
    // The scope keeps its own photos of them by their deletion (contactLinkedPhotoIds).
    const ofContacts = contactIds.length ? sql`a.id in ${contactLinkedPhotoIds(contactIds)}` : undefined;
    return or(inJson(a.id, matchingIds(rows, searchText)), ofContacts);
  }

  function where(matched: SQL | undefined) {
    return and(assetScopeWhere(scope, sort), ...filterConditions, matched);
  }

  return {
    descriptor: { scope, sort, filter, search, exclude },
    tables,
    read(db, { limit }): Promise<{ rows: AssetRow[]; count: number }> {
      return db.transaction(async (tx) => {
        const matched = await matchedWhere(tx);
        const [{ count: total }] = await fromScope(tx.select({ count: count() }), scope, sort).where(where(matched));
        const rows = await fromScope(tx.select(getTableColumns(a)), scope, sort)
          .where(where(matched))
          .orderBy(assetOrder(scope, sort))
          .limit(limit);
        return { rows, count: total };
      });
    },
    ids(db, { limit } = {}) {
      return db.transaction(async (tx) => {
        const query = fromScope(tx.select({ id: a.id }), scope, sort)
          .where(where(await matchedWhere(tx)))
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
