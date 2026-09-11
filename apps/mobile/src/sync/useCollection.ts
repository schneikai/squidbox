/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { getDb } from './db/client';

// Generic reactive id-keyed map for a collection's SQLite table (includes tombstoned rows;
// screens filter by deletedAt). Used by the albums/posts providers.
// `paused` (during the initial bulk sync) queries LIMIT 0 so useLiveQuery doesn't load the whole
// table on every applied page; deps=[paused] re-subscribe to the full query once when sync ends.
function useLiveRows(table: SQLiteTable, paused: boolean): any[] {
  const q = paused ? getDb().select().from(table).limit(0) : getDb().select().from(table);
  const { data } = useLiveQuery(q, [paused]);
  return (data as any[]) ?? [];
}

export function useLiveCollectionMap(table: SQLiteTable, paused = false): Record<string, any> {
  const rows = useLiveRows(table, paused);
  const map: Record<string, any> = {};
  for (const row of rows) map[row.id] = row;
  return map;
}

// Reactive array of a table's rows (used for edge tables, which are grouped/joined not id-keyed).
export function useLiveCollectionRows(table: SQLiteTable, paused = false): any[] {
  return useLiveRows(table, paused);
}
