/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import { collectionsByName } from '@squidbox/shared';
import { getTableColumns, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { SyncDb } from './db/types';
import { chunk } from './pushPlan';

const BATCH = 500; // rows per INSERT; ~20 columns each stays far below SQLite's 32,766 variables

const conflictSets = new Map<SQLiteTable, Record<string, unknown>>();

/**
 * Insert whole records of a collection, or update them by id, a statement per 500. An update takes
 * every synced column from the record; local-only columns (e.g. syncError of assets) keep their
 * value, and a new row gets them from the record or null.
 */
export async function upsertRows(
  db: SyncDb,
  collection: string,
  table: SQLiteTable,
  rows: Record<string, unknown>[],
): Promise<void> {
  const set = conflictSet(collection, table);
  for (const batch of chunk(rows, BATCH)) {
    await db
      .insert(table)
      .values(batch as any)
      .onConflictDoUpdate({ target: (table as any).id, set });
  }
}

function conflictSet(collection: string, table: SQLiteTable): Record<string, unknown> {
  let set = conflictSets.get(table);
  if (!set) {
    const localOnly = new Set(Object.keys(collectionsByName[collection]?.localOnly ?? {}));
    const synced = Object.entries(getTableColumns(table)).filter(([key]) => !localOnly.has(key));
    set = Object.fromEntries(synced.map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)]));
    conflictSets.set(table, set);
  }
  return set;
}
