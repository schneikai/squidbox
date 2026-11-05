import { isNull } from 'drizzle-orm';

import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const c = schema.contacts;

/** Every live contact's id, name, avatar and handles, live, for the duplicate check; undefined while reading. */
export default function useContactHandles() {
  return useLiveQuery(
    (db) =>
      db
        .select({
          id: c.id,
          name: c.name,
          avatarFilename: c.avatarFilename,
          xHandle: c.xHandle,
          blueskyHandle: c.blueskyHandle,
          onlyFansHandle: c.onlyFansHandle,
          jffHandle: c.jffHandle,
        })
        .from(c)
        .where(isNull(c.deletedAt)),
    [schema.contacts],
  );
}
