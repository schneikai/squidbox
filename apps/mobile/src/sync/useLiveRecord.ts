import type { CollectionTable, RowOf } from './clientCollections';
import { readByIds } from './readByIds';
import { useLiveQuery } from './useLiveQuery';

/**
 * One record of `table`, live: `undefined` until read, `null` when it doesn't exist or was deleted.
 * After a change of `id` it is `undefined` again until that record is read, not the previous one's.
 * An `undefined` id (nothing to show yet) reads and watches nothing: `undefined`, then `null`.
 */
export function useLiveRecord<T extends CollectionTable>(
  table: T,
  id: string | undefined,
): RowOf<T> | null | undefined {
  const result = useLiveQuery(
    async (db) => {
      if (id === undefined) return { id, record: null };
      const [record] = await readByIds(db, table, [id]);
      return { id, record: record && !record.deletedAt ? record : null };
    },
    id === undefined ? [] : [table],
    [id],
  );
  return result && result.id === id ? result.record : undefined;
}
