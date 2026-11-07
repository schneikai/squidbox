import type { ContactLinkRecord } from '@squidbox/shared';
import { and, asc, count, desc, eq, isNotNull, isNull, type SQL, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import contactSearchText, { SEARCHED_FIELDS } from './contactSearchText';
import type { ContactSort } from './contactSortOptions';

import { liveAlbumAssetIds, postThreadAssetIds } from '@/sync/assetSql';
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
  instagramHandle: c.instagramHandle,
  phoneNumber: c.phoneNumber,
  places: c.places,
} satisfies Record<(typeof SEARCHED_FIELDS)[number] | 'places', unknown>;

// What rows, chips and avatars show of a contact, and a search runs over (no notes).
const SUMMARY = { id: c.id, isFavorite: c.isFavorite, avatarFilename: c.avatarFilename, ...SEARCHED };

/**
 * What a row, chip or avatar shows of a contact (contactQuery's `summaries`), and with `withLists`
 * the names of the lists it is in, by name.
 */
export type ContactSummary = Pick<schema.ContactRow, 'id' | 'isFavorite' | 'avatarFilename' | keyof typeof SEARCHED> & {
  listNames?: string[];
};

// The names of the live lists a contact is in, by name, as a JSON array.
const LIST_NAMES = sql<
  string | null
>`(select json_group_array(name) from (select l.name as name from contact_list_members m join contact_lists l on l.id = m.list_id and l.deleted_at is null where m.contact_id = contacts.id and m.deleted_at is null group by l.id order by l.name collate nocase, l.id))`;

/**
 * A list's members, or the contacts on a photo, album or post (several of one type with a list of
 * ids). `photosOf`: the contacts on the live, untrashed photos of an album or a post (a thread's
 * posts too), which is how an album or post lists who is in it. `tagged`: the contacts on any photo,
 * album or post; `deleted`: the deleted contacts.
 */
export type ContactScope =
  | 'all'
  | 'favorites'
  | 'tagged'
  | 'deleted'
  | { listId: string }
  | { targetType: ContactLinkRecord['targetType']; targetId: string | string[] }
  | { photosOf: 'album' | 'post'; id: string };

export type ContactDescriptor = {
  scope?: ContactScope;
  // A substring of the name, a handle, the phone number or a place: Unicode-aware, literal,
  // case-insensitive.
  search?: string;
  // By name ignoring case, or recently added first: to the app, or in a list's scope to that list.
  sort?: ContactSort;
  // `read`'s rows carry the names of the lists each contact is in (a contact row's pills).
  withLists?: boolean;
};

/**
 * What a contact list shows (ContactDescriptor), as SQL: `read(db, { limit })` → `{ rows, count }`
 * from one transaction (no `limit` reads them all), the rows as SUMMARY, `summaries(db)` → all the rows without their
 * count, only what a row shows and a search runs over (SUMMARY), `ids(db)` → the matching ids in the
 * same order, `tables` → what a live read watches. Live contacts only (deleted ones only in the
 * Deleted scope), in `sort` order (Favorites always by when they were favorited, Deleted by when they
 * were deleted, newest first), with an id tie-break so pages see one stable
 * order.
 */
export default function contactQuery({
  scope = 'all',
  search = '',
  sort = 'name:asc',
  withLists = false,
}: ContactDescriptor) {
  const searchText = search.trim().toLowerCase();
  const listId = typeof scope === 'object' && 'listId' in scope ? scope.listId : null;
  const target = typeof scope === 'object' && 'targetType' in scope ? scope : null;
  const photosOf = typeof scope === 'object' && 'photosOf' in scope ? scope : null;
  const tables: SQLiteTable[] = [schema.contacts];
  if (listId) tables.push(schema.contactListMembers);
  if (target) tables.push(schema.contactLinks);
  if (photosOf) {
    tables.push(schema.contactLinks, schema.assets);
    tables.push(...(photosOf.photosOf === 'album' ? [schema.albumAssets] : [schema.postAssets, schema.posts]));
  }
  if (scope === 'tagged') tables.push(schema.contactLinks, schema.assets, schema.albums, schema.posts);
  if (withLists) tables.push(schema.contactLists, ...(listId ? [] : [schema.contactListMembers]));

  const scopeCondition = ((): SQL | undefined => {
    if (scope === 'favorites') return eq(c.isFavorite, true);
    // On something still there: deleting a photo, album or post leaves its links be.
    if (scope === 'tagged')
      return sql`${c.id} in (select l.contact_id from contact_links l where l.deleted_at is null and exists (
        select 1 from assets a where l.target_type = 'asset' and a.id = l.target_id and a.deleted_at is null
        union all select 1 from albums b where l.target_type = 'album' and b.id = l.target_id and b.deleted_at is null
        union all select 1 from posts p where l.target_type = 'post' and p.id = l.target_id and p.deleted_at is null))`;
    if (listId) {
      return sql`${c.id} in (select contact_id from contact_list_members where list_id = ${listId} and deleted_at is null)`;
    }
    if (target) {
      const ids = Array.isArray(target.targetId) ? target.targetId : [target.targetId];
      return sql`${c.id} in (select contact_id from contact_links where target_type = ${target.targetType} and deleted_at is null and ${inJson(sql.raw('target_id'), ids)})`;
    }
    if (photosOf) {
      const photoIds = photosOf.photosOf === 'album' ? liveAlbumAssetIds(photosOf.id) : postThreadAssetIds(photosOf.id);
      return sql`${c.id} in (select l.contact_id from contact_links l join assets a on a.id = l.target_id and a.deleted_at is null
        where l.target_type = 'asset' and l.deleted_at is null and l.target_id in ${photoIds})`;
    }
    return undefined;
  })();
  const order = (() => {
    if (scope === 'favorites') return [desc(c.favoritedAt), asc(c.id)];
    if (scope === 'deleted') return [desc(c.deletedAt), asc(c.id)];
    if (sort !== 'createdAt:desc') return [asc(sql`${c.name} collate nocase`), asc(c.id)];
    // In a list, when the contact joined it: its live edge's last write, which is its creation or,
    // for a contact added again, the restore of its edge (createdAt keeps the first add, and doesn't
    // sync a change); the latest, should two devices have added it.
    const added = listId
      ? sql`(select max(updated_at) from contact_list_members where list_id = ${listId} and contact_id = ${c.id} and deleted_at is null)`
      : c.createdAt;
    return [desc(added), asc(c.id)];
  })();

  // The live contacts, or in the Deleted scope the deleted ones.
  const liveness = scope === 'deleted' ? isNotNull(c.deletedAt) : isNull(c.deletedAt);

  // The search reads every live contact's searched text once per read, for rows and count alike.
  async function matchedIds(tx: SyncDb): Promise<string[] | null> {
    if (!searchText) return null;
    const rows = await tx
      .select({ id: c.id, ...SEARCHED })
      .from(c)
      .where(liveness);
    return matchingIds(
      rows.map((row) => ({ id: row.id, text: contactSearchText(row) })),
      searchText,
    );
  }
  const where = (ids: string[] | null) => and(liveness, scopeCondition, ids ? inJson(c.id, ids) : undefined);

  return {
    descriptor: { scope, search, sort, withLists },
    tables,
    read(db: SyncDb, { limit }: { limit?: number } = {}): Promise<{ rows: ContactSummary[]; count: number }> {
      return db.transaction(async (tx) => {
        const ids = await matchedIds(tx);
        const [{ count: total }] = await tx.select({ count: count() }).from(c).where(where(ids));
        const query = tx
          .select({ ...SUMMARY, listNames: withLists ? LIST_NAMES : sql<string | null>`null` })
          .from(c)
          .where(where(ids))
          .orderBy(...order);
        const rows = await (limit === undefined ? query : query.limit(limit));
        return {
          rows: rows.map(({ listNames, ...row }) =>
            listNames == null ? row : { ...row, listNames: JSON.parse(listNames) as string[] },
          ),
          count: total,
        };
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
