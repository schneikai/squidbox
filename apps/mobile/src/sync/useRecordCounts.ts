import { sql } from 'drizzle-orm';

import { getDb } from './db/client';
import * as schema from './db/schema';
import { useLiveQuery } from './useLiveQuery';

const NO_ROWS: never[] = [];

/** Live counts of a collection's records: live ones and tombstones. */
export function useRecordCounts(table: typeof schema.assets | typeof schema.albums | typeof schema.posts) {
  const [row] =
    useLiveQuery(
      () =>
        getDb()
          .select({
            records: sql<number>`count(*) filter (where ${table.deletedAt} is null)`,
            tombstones: sql<number>`count(*) filter (where ${table.deletedAt} is not null)`,
          })
          .from(table),
      [table],
    ) ?? NO_ROWS;
  return { records: Number(row?.records ?? 0), tombstones: Number(row?.tombstones ?? 0) };
}
