import { and, asc, count, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';

import * as schema from '@/sync/db/schema';
import { inJson } from '@/sync/inJson';
import { matchingIds } from '@/sync/matchingIds';

const c = schema.contacts;

// The text a search runs over: the name, the handles, the phone number and the places.
const SEARCHED = ['name', 'xHandle', 'blueskyHandle', 'onlyFansHandle', 'jffHandle', 'phoneNumber'];

/**
 * What a contact list shows, as SQL: `read(db, { limit })` → `{ rows, count }` from one
 * transaction (no `limit` reads them all), `ids(db)` → the matching ids in the same order, `tables`
 * → what a live read watches. Live contacts only, by name (Favorites by when they were favorited,
 * newest first), with an id tie-break so pages see one stable order.
 * @param {object} descriptor
 * @param {'all' | 'favorites' | { listId: string } | { targetType: 'asset' | 'album' | 'post', targetId: string | string[] }} [descriptor.scope]
 *   a list's members, or the contacts on a photo, album or post (several of one type with a list of ids)
 * @param {string} [descriptor.search] a substring of the name, a handle, the phone number or a
 *   place: Unicode-aware, literal, case-insensitive
 */
export default function contactQuery({ scope = 'all', search = '' }) {
  const searchText = search.trim().toLowerCase();
  const tables = [schema.contacts];
  if (scope.listId) tables.push(schema.contactListMembers);
  if (scope.targetType) tables.push(schema.contactLinks);

  const scopeCondition = (() => {
    if (scope === 'favorites') return eq(c.isFavorite, true);
    if (scope.listId) {
      return sql`${c.id} in (select contact_id from contact_list_members where list_id = ${scope.listId} and deleted_at is null)`;
    }
    if (scope.targetType) {
      const ids = Array.isArray(scope.targetId) ? scope.targetId : [scope.targetId];
      return sql`${c.id} in (select contact_id from contact_links where target_type = ${scope.targetType} and deleted_at is null and ${inJson(sql.raw('target_id'), ids)})`;
    }
    return undefined;
  })();
  const order =
    scope === 'favorites' ? [desc(c.favoritedAt), asc(c.id)] : [asc(sql`${c.name} collate nocase`), asc(c.id)];

  // The search reads every live contact's searched text once per read, for rows and count alike.
  async function matchedIds(tx) {
    if (!searchText) return null;
    const rows = await tx
      .select({ id: c.id, places: c.places, ...Object.fromEntries(SEARCHED.map((name) => [name, c[name]])) })
      .from(c)
      .where(isNull(c.deletedAt));
    const texts = rows.map((row) => ({
      id: row.id,
      text: [...SEARCHED.map((name) => row[name]), ...row.places].filter(Boolean).join('\n'),
    }));
    return matchingIds(texts, searchText);
  }
  const where = (ids) => and(isNull(c.deletedAt), scopeCondition, ids ? inJson(c.id, ids) : undefined);

  return {
    descriptor: { scope, search },
    tables,
    read(db, { limit } = {}) {
      return db.transaction(async (tx) => {
        const ids = await matchedIds(tx);
        const [{ count: total }] = await tx.select({ count: count() }).from(c).where(where(ids));
        const query = tx
          .select(getTableColumns(c))
          .from(c)
          .where(where(ids))
          .orderBy(...order);
        const rows = await (limit === undefined ? query : query.limit(limit));
        return { rows, count: total };
      });
    },
    ids(db) {
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
