/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { inJson } from './assetSql';
import type { SyncDb } from './db/types';

/** The rows of `table` with these ids (tombstones included), in one statement. */
export async function readByIds<R = any>(db: SyncDb, table: SQLiteTable, ids: string[]): Promise<R[]> {
  if (ids.length === 0) return [];
  return (await db
    .select()
    .from(table)
    .where(inJson((table as any).id, ids))) as R[];
}
