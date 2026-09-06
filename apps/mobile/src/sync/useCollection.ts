/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { getDb } from './db/client';

// Generic reactive id-keyed map for a collection's SQLite table (includes tombstoned rows;
// screens filter by deletedAt). Used by the albums/posts providers.
export function useLiveCollectionMap(table: SQLiteTable): Record<string, any> {
  const { data } = useLiveQuery(getDb().select().from(table));
  const map: Record<string, any> = {};
  for (const row of (data as any[]) ?? []) map[row.id] = row;
  return map;
}
