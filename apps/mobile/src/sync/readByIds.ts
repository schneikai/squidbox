/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { SyncDb } from './db/types';
import { inJson } from './inJson';

/** The rows of `table` with these ids (tombstones included) by id, read in one statement. */
export async function readByIdMap<R = any>(db: SyncDb, table: SQLiteTable, ids: string[]): Promise<Map<string, R>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select()
    .from(table)
    .where(inJson((table as any).id, [...new Set(ids)]));
  return new Map(rows.map((row: any) => [row.id, row]));
}

/** The rows of `table` with these ids (tombstones included), once each, in `ids` order. */
export async function readByIds<R = any>(db: SyncDb, table: SQLiteTable, ids: string[]): Promise<R[]> {
  const byId = await readByIdMap<R>(db, table, ids);
  return [...new Set(ids)].map((id) => byId.get(id)).filter((row): row is R => row !== undefined);
}
