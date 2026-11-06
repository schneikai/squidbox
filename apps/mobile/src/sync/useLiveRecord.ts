import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { readByIds } from './readByIds';
import { useLiveQuery } from './useLiveQuery';

/**
 * One record of `table`, live: `undefined` until read, `null` when it doesn't exist or was deleted.
 * After a change of `id` it is `undefined` again until that record is read, not the previous one's.
 */
export function useLiveRecord<R extends { deletedAt: number | null }>(
  table: SQLiteTable,
  id: string,
): R | null | undefined {
  const result = useLiveQuery(
    async (db) => {
      const [record] = await readByIds<R>(db, table, [id]);
      return { id, record: record && !record.deletedAt ? record : null };
    },
    [table],
    [id],
  );
  return result && result.id === id ? result.record : undefined;
}
