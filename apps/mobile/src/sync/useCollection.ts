/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { useMemo } from 'react';

import { useLiveTable } from './useLiveTable';

const NO_ROWS: any[] = [];

// Live id-keyed map of a collection's rows, including tombstoned ones (screens filter by deletedAt,
// which keeps features like the "Deleted" album). The providers only mount after the initial pull
// (see AppGate), so they never watch the bulk load.
export function useLiveCollectionMap(table: SQLiteTable): Record<string, any> {
  const rows = useLiveCollectionRows(table);
  return useMemo(() => Object.fromEntries(rows.map((row) => [row.id, row])), [rows]);
}

// Live array of a table's rows (edge tables are grouped and joined, not looked up by id).
export function useLiveCollectionRows(table: SQLiteTable): any[] {
  return useLiveTable<any>(table) ?? NO_ROWS;
}
