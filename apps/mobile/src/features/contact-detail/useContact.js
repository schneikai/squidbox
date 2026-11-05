import { schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * One contact, live: `undefined` until read, `null` when it doesn't exist or was deleted. After a
 * change of `contactId` it is `undefined` again until that contact is read.
 */
export default function useContact(contactId) {
  const result = useLiveQuery(
    async (db) => {
      const [contact] = await readByIds(db, schema.contacts, [contactId]);
      return { contactId, contact: contact && !contact.deletedAt ? contact : null };
    },
    [schema.contacts],
    [contactId],
  );
  return result && result.contactId === contactId ? result.contact : undefined;
}
