import { chunk } from '@squidbox/shared';
/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import { getTableColumns, getTableName, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { SQL_BATCH } from './chunk';
import type { SyncDb } from './db/types';
import { localOnlyKeys } from './localOnlyKeys';

const conflictSets = new Map<string, Record<string, unknown>>();

/**
 * Insert whole records of a collection, or update them by id, a statement per 500. An update takes
 * the synced columns the records carry; columns they leave out (e.g. one the server doesn't know
 * yet) and local-only columns (e.g. syncError of assets) keep their value. A new row gets them from
 * the record or null. SQLite checks NOT NULL before the conflict, so a record missing a NOT NULL
 * column fails even as an update: give new synced columns a default or ship them on the server first.
 */
export async function upsertRows(
  db: SyncDb,
  collection: string,
  table: SQLiteTable,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (const batch of chunk(rows, SQL_BATCH)) {
    await db
      .insert(table)
      .values(batch as any)
      .onConflictDoUpdate({ target: (table as any).id, set: conflictSet(collection, table, keysOfAll(batch)) });
  }
}

function keysOfAll(rows: Record<string, unknown>[]): string[] {
  return Object.keys(rows[0]!).filter((key) => rows.every((row) => row[key] !== undefined));
}

// Cached per table and key set: records of a collection almost always carry the same keys.
function conflictSet(collection: string, table: SQLiteTable, keys: string[]): Record<string, unknown> {
  const signature = `${getTableName(table)}:${keys.join(',')}`;
  let set = conflictSets.get(signature);
  if (!set) {
    const columns = getTableColumns(table);
    const localOnly = localOnlyKeys(collection);
    const synced = keys.filter((key) => key in columns && !localOnly.has(key));
    set = Object.fromEntries(synced.map((key) => [key, sql.raw(`excluded."${columns[key]!.name}"`)]));
    conflictSets.set(signature, set);
  }
  return set;
}
