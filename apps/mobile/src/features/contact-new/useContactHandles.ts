import type { ContactHandleField } from '@squidbox/shared';
import { isNull } from 'drizzle-orm';

import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const c = schema.contacts;

// Every handle's column (CONTACT_HANDLE_FIELDS).
const HANDLES = {
  xHandle: c.xHandle,
  blueskyHandle: c.blueskyHandle,
  onlyFansHandle: c.onlyFansHandle,
  jffHandle: c.jffHandle,
} satisfies Record<ContactHandleField, unknown>;

/** A live contact as the duplicate check reads it (useContactHandles). */
export type ContactHandles = Pick<schema.ContactRow, 'id' | 'name' | 'avatarFilename' | ContactHandleField>;

/** Every live contact's id, name, avatar and handles, live, for the duplicate check; undefined while reading. */
export default function useContactHandles(): ContactHandles[] | undefined {
  return useLiveQuery(
    (db) =>
      db
        .select({ id: c.id, name: c.name, avatarFilename: c.avatarFilename, ...HANDLES })
        .from(c)
        .where(isNull(c.deletedAt)),
    [schema.contacts],
  );
}
