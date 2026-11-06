import type { ContactLinkRecord } from '@squidbox/shared';
import { and, asc, count, desc, eq, isNull, type SQL, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import contactSearchText, { SEARCHED_FIELDS } from './contactSearchText';
import type { ContactSort } from './contactSortOptions';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { matchingIds } from '@/sync/matchingIds';

const c = schema.contacts;

// The columns a search runs over.
const SEARCHED = {
  name: c.name,
  xHandle: c.xHandle,
  blueskyHandle: c.blueskyHandle,
  onlyFansHandle: c.onlyFansHandle,
  jffHandle: c.jffHandle,
  phoneNumber: c.phoneNumber,
  places: c.places,
} satisfies Record<(typeof SEARCHED_FIELDS)[number] | 'places', unknown>;

// What rows, chips and avatars show of a contact, and a search runs over (no notes).
const SUMMARY = { id: c.id, isFavorite: c.isFavorite, avatarFilename: c.avatarFilename, ...SEARCHED };

/** What a row, chip or avatar shows of a contact (contactQuery's `summaries`). */
export type ContactSummary = Pick<schema.ContactRow, 'id' | 'isFavorite' | 'avatarFilename' | keyof typeof SEARCHED>;

/** A list's members, or the contacts on a photo, album or post (several of one type with a list of ids). */
export type ContactScope =
  | 'all'
  | 'favorites'
  | { listId: string }
  | { targetType: ContactLinkRecord['targetType']; targetId: string | string[] };

export type ContactDescriptor = {
  scope?: ContactScope;
  // A substring of the name, a handle, the phone number or a place: Unicode-aware, literal,
  // case-insensitive.
  search?: string;
  // By name ignoring case, or recently added first: to the app, or in a list's scope to that list.
  sort?: ContactSort;
};

/**
 * What a contact list shows (ContactDescriptor), as SQL: `read(db, { limit })` → `{ rows, count }`
 * from one transaction (no `limit` reads them all), the rows as SUMMARY, `summaries(db)` → all the rows without their
 * count, only what a row shows and a search runs over (SUMMARY), `ids(db)` → the matching ids in the
 * same order, `tables` → what a live read watches. Live contacts only, in `sort` order (Favorites
 * always by when they were favorited, newest first), with an id tie-break so pages see one stable
 * order.
 */
export default function contactQuery({ scope = 'all', search = '', sort = 'name:asc' }: ContactDescriptor) {
  const searchText = search.trim().toLowerCase();
  const listId = typeof scope === 'object' && 'listId' in scope ? scope.listId : null;
  const target = typeof scope === 'object' && 'targetType' in scope ? scope : null;
  const tables: SQLiteTable[] = [schema.contacts];
  if (listId) tables.push(schema.contactListMembers);
  if (target) tables.push(schema.contactLinks);

  const scopeCondition = ((): SQL | undefined => {
    if (scope === 'favorites') return eq(c.isFavorite, true);
    if (listId) {
      return sql`${c.id} in (select contact_id from contact_list_members where list_id = ${listId} and deleted_at is null)`;
    }
    if (target) {
      const ids = Array.isArray(target.targetId) ? target.targetId : [target.targetId];
      return sql`${c.id} in (select contact_id from contact_links where target_type = ${target.targetType} and deleted_at is null and ${inJson(sql.raw('target_id'), ids)})`;
    }
    return undefined;
  })();
  const order = (() => {
    if (scope === 'favorites') return [desc(c.favoritedAt), asc(c.id)];
    if (sort !== 'createdAt:desc') return [asc(sql`${c.name} collate nocase`), asc(c.id)];
    // In a list, when the contact joined it (its latest live edge, should two devices have added it).
    const added = listId
      ? sql`(select max(created_at) from contact_list_members where list_id = ${listId} and contact_id = ${c.id} and deleted_at is null)`
      : c.createdAt;
    return [desc(added), asc(c.id)];
  })();

  // The search reads every live contact's searched text once per read, for rows and count alike.
  async function matchedIds(tx: SyncDb): Promise<string[] | null> {
    if (!searchText) return null;
    const rows = await tx
      .select({ id: c.id, ...SEARCHED })
      .from(c)
      .where(isNull(c.deletedAt));
    return matchingIds(
      rows.map((row) => ({ id: row.id, text: contactSearchText(row) })),
      searchText,
    );
  }
  const where = (ids: string[] | null) => and(isNull(c.deletedAt), scopeCondition, ids ? inJson(c.id, ids) : undefined);

  return {
    descriptor: { scope, search, sort },
    tables,
    read(db: SyncDb, { limit }: { limit?: number } = {}): Promise<{ rows: ContactSummary[]; count: number }> {
      return db.transaction(async (tx) => {
        const ids = await matchedIds(tx);
        const [{ count: total }] = await tx.select({ count: count() }).from(c).where(where(ids));
        const query = tx
          .select(SUMMARY)
          .from(c)
          .where(where(ids))
          .orderBy(...order);
        const rows = await (limit === undefined ? query : query.limit(limit));
        return { rows, count: total };
      });
    },
    summaries(db: SyncDb): Promise<ContactSummary[]> {
      return db.transaction(async (tx) =>
        tx
          .select(SUMMARY)
          .from(c)
          .where(where(await matchedIds(tx)))
          .orderBy(...order),
      );
    },
    ids(db: SyncDb): Promise<string[]> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({ id: c.id })
          .from(c)
          .where(where(await matchedIds(tx)))
          .orderBy(...order);
        return rows.map((row) => row.id);
      });
    },
  };
}
