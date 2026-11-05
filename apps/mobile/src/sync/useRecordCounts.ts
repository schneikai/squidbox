import { sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import { useLiveQuery } from './useLiveQuery';

const NO_ROWS: never[] = [];

/** Live counts of a collection's records: live ones and tombstones. */
export function useRecordCounts(table: SQLiteTable & { deletedAt: SQLiteColumn }) {
  const [row] =
    useLiveQuery(
      (db) =>
        db
          .select({
            records: sql<number>`count(*) filter (where ${table.deletedAt} is null)`,
            tombstones: sql<number>`count(*) filter (where ${table.deletedAt} is not null)`,
          })
          .from(table),
      [table],
    ) ?? NO_ROWS;
  return { records: Number(row?.records ?? 0), tombstones: Number(row?.tombstones ?? 0) };
}
