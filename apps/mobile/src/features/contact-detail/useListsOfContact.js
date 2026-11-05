import { and, asc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';

import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const l = schema.contactLists;
const m = schema.contactListMembers;

/** The live lists `contactId` is in, by name, live; undefined while reading. */
export default function useListsOfContact(contactId) {
  return useLiveQuery(
    (db) =>
      db
        .selectDistinct(getTableColumns(l))
        .from(l)
        .innerJoin(m, and(eq(m.listId, l.id), eq(m.contactId, contactId), isNull(m.deletedAt)))
        .where(isNull(l.deletedAt))
        .orderBy(asc(sql`${l.name} collate nocase`), asc(l.id)),
    [schema.contactLists, schema.contactListMembers],
    [contactId],
  );
}
