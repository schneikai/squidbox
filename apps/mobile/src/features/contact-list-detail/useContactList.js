import { schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** One contact list, live: `undefined` until read, `null` when it doesn't exist or was deleted. */
export default function useContactList(listId) {
  const result = useLiveQuery(
    async (db) => {
      const [list] = await readByIds(db, schema.contactLists, [listId]);
      return { listId, list: list && !list.deletedAt ? list : null };
    },
    [schema.contactLists],
    [listId],
  );
  return result && result.listId === listId ? result.list : undefined;
}
