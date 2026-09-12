/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { getDb } from './db/client';

// Generic reactive id-keyed map for a collection's SQLite table (includes tombstoned rows;
// screens filter by deletedAt). Used by the albums/posts providers, which only mount after the
// initial pull finishes (see AppGate), so there's no bulk-load storm to guard against.
function useLiveRows(table: SQLiteTable): any[] {
  const { data } = useLiveQuery(getDb().select().from(table));
  return (data as any[]) ?? [];
}

export function useLiveCollectionMap(table: SQLiteTable): Record<string, any> {
  const rows = useLiveRows(table);
  const map: Record<string, any> = {};
  for (const row of rows) map[row.id] = row;
  return map;
}

// Reactive array of a table's rows (used for edge tables, which are grouped/joined not id-keyed).
export function useLiveCollectionRows(table: SQLiteTable): any[] {
  return useLiveRows(table);
}
