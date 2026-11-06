import { sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { SyncDb } from './db/types';
import { useLiveQuery } from './useLiveQuery';

type CollectionTable = SQLiteTable & { deletedAt: SQLiteColumn };

/** A collection's records: live ones and tombstones. */
async function readRecordCounts(db: SyncDb, table: CollectionTable) {
  const [row] = await db
    .select({
      records: sql<number>`count(*) filter (where ${table.deletedAt} is null)`,
      tombstones: sql<number>`count(*) filter (where ${table.deletedAt} is not null)`,
    })
    .from(table);
  return { records: Number(row?.records ?? 0), tombstones: Number(row?.tombstones ?? 0) };
}

const NONE = { records: 0, tombstones: 0 };

/** Live counts of a collection's records (readRecordCounts), re-read only on a write to its table. */
export function useRecordCounts(table: CollectionTable) {
  return useLiveQuery((db) => readRecordCounts(db, table), [table]) ?? NONE;
}
