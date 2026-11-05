import { and, asc, count, eq, getTableColumns, isNull, lte, sql } from 'drizzle-orm';

import * as schema from '@/sync/db/schema';

const l = schema.contactLists;
const m = schema.contactListMembers;
const c = schema.contacts;
const STACK = 3;

/**
 * The contact lists, by name, as SQL: `read(db)` → every live list with `memberCount` (its live
 * contacts, each once) and, `withMembers`, `firstMembers` (the first three of them by name: `id`,
 * `name`, `avatarFilename`, for the row's avatar stack), from one transaction; `tables` → what a
 * live read watches. SQL counts and ranks the members, so it reads lists × 3 rows, not every member.
 */
export default function contactListQuery({ withMembers = true } = {}) {
  return {
    descriptor: { withMembers },
    tables: [schema.contactLists, schema.contactListMembers, schema.contacts],
    read(db) {
      return db.transaction(async (tx) => {
        const lists = await tx
          .select(getTableColumns(l))
          .from(l)
          .where(isNull(l.deletedAt))
          .orderBy(asc(sql`${l.name} collate nocase`), asc(l.id));
        // Each live (list, contact) pair once, of a live contact.
        const pairs = tx
          .selectDistinct({ listId: m.listId, contactId: m.contactId })
          .from(m)
          .innerJoin(c, and(eq(c.id, m.contactId), isNull(c.deletedAt)))
          .where(isNull(m.deletedAt))
          .as('p');
        const counts = await tx.select({ listId: pairs.listId, count: count() }).from(pairs).groupBy(pairs.listId);
        const memberCounts = new Map(counts.map((row) => [row.listId, row.count]));
        const byList = new Map(lists.map((list) => [list.id, []]));
        if (withMembers) {
          const ranked = tx
            .select({
              listId: pairs.listId,
              id: c.id,
              name: c.name,
              avatarFilename: c.avatarFilename,
              rank: sql`row_number() over (partition by ${pairs.listId} order by ${c.name} collate nocase, ${c.id})`.as(
                'rank',
              ),
            })
            .from(pairs)
            .innerJoin(c, eq(c.id, pairs.contactId))
            .as('r');
          const first = await tx
            .select()
            .from(ranked)
            .where(lte(ranked.rank, STACK))
            .orderBy(ranked.listId, ranked.rank);
          for (const { listId, rank: _rank, ...member } of first) byList.get(listId)?.push(member);
        }
        return lists.map((list) => ({
          ...list,
          memberCount: memberCounts.get(list.id) ?? 0,
          ...(withMembers && { firstMembers: byList.get(list.id) }),
        }));
      });
    },
  };
}
