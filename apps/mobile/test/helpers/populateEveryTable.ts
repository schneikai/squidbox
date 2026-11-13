import { getTableColumns, is, sql } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { SyncDb } from '../../src/sync/db/types';

const NOW = 1_800_000_000_000;

/**
 * One row in every table of `schema` (a build's drizzle schema module) that has none yet, written
 * through `db` as that build writes it: a nullable column null, a column with a default its default,
 * and every other column a value of its type (an id the same `id` everywhere, so references meet; an
 * enum its first value; a JSON column `[]`). An update's migrations then run over rows in every table,
 * as on a phone that used the build (installedBuilds.e2e).
 */
export async function populateEveryTable(db: SyncDb, schema: Record<string, unknown>, id: string): Promise<void> {
  for (const table of Object.values(schema)) {
    if (!is(table, SQLiteTable)) continue;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(table);
    if (count > 0) continue;
    const row: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(getTableColumns(table)))
      if (column.notNull && !column.hasDefault) row[key] = valueOf(key, column, id);
    // drizzle: the table is the build's, picked at runtime, so its insert model is unknown here
    await db.insert(table).values(row as never);
  }
}

function valueOf(
  key: string,
  column: { columnType: string; enumValues?: string[]; name: string },
  id: string,
): unknown {
  if (column.enumValues?.length) return column.enumValues[0];
  switch (column.columnType) {
    case 'SQLiteTextJson':
    case 'SQLiteBlobJson':
      return [];
    case 'SQLiteText':
      return key === 'id' || key.endsWith('Id') ? id : `seed ${key}`;
    case 'SQLiteBoolean':
      return false;
    case 'SQLiteInteger':
    case 'SQLiteTimestamp':
      return NOW;
    case 'SQLiteReal':
    case 'SQLiteNumeric':
      return 1;
    default:
      throw new Error(`populateEveryTable: no value for ${column.name} (${column.columnType})`);
  }
}
