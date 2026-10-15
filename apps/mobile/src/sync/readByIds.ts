/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { SyncDb } from './db/types';
import { inJson } from './inJson';

/** The rows of `table` with these ids (tombstones included), in `ids` order, read in one statement. */
export async function readByIds<R = any>(db: SyncDb, table: SQLiteTable, ids: string[]): Promise<R[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(table)
    .where(inJson((table as any).id, ids));
  const byId = new Map(rows.map((row: any) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as R[];
}
