/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import { inArray } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { chunk, SQL_BATCH } from './chunk';
import type { SyncDb } from './db/types';

/** The rows of `table` with these ids (tombstones included), a statement per 500 ids. */
export async function readByIds<R = any>(db: SyncDb, table: SQLiteTable, ids: string[]): Promise<R[]> {
  const rows: R[] = [];
  for (const batch of chunk(ids, SQL_BATCH)) {
    const found = await db
      .select()
      .from(table)
      .where(inArray((table as any).id, batch));
    rows.push(...(found as R[]));
  }
  return rows;
}
