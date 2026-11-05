import { and, asc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';

import * as schema from '@/sync/db/schema';

const l = schema.contactLists;
const m = schema.contactListMembers;
const c = schema.contacts;
const STACK = 3;

/**
 * The contact lists, by name, as SQL: `read(db)` → every live list with `memberCount` (its live
 * contacts, each once) and `firstMembers` (the first three of them by name: `id`, `name`,
 * `avatarFilename`, for the row's avatar stack), from one transaction; `tables` → what a live read
 * watches.
 */
export default function contactListQuery() {
  return {
    descriptor: {},
    tables: [schema.contactLists, schema.contactListMembers, schema.contacts],
    read(db) {
      return db.transaction(async (tx) => {
        const lists = await tx
          .select(getTableColumns(l))
          .from(l)
          .where(isNull(l.deletedAt))
          .orderBy(asc(sql`${l.name} collate nocase`), asc(l.id));
        const members = await tx
          .selectDistinct({ listId: m.listId, id: c.id, name: c.name, avatarFilename: c.avatarFilename })
          .from(m)
          .innerJoin(c, and(eq(c.id, m.contactId), isNull(c.deletedAt)))
          .where(isNull(m.deletedAt))
          .orderBy(asc(sql`${c.name} collate nocase`), asc(c.id));
        const byList = new Map(lists.map((list) => [list.id, []]));
        for (const { listId, ...member } of members) byList.get(listId)?.push(member);
        return lists.map((list) => {
          const listMembers = byList.get(list.id);
          return { ...list, memberCount: listMembers.length, firstMembers: listMembers.slice(0, STACK) };
        });
      });
    },
  };
}
