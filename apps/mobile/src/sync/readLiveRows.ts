/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any table's rows */
import { and, eq, getTableColumns, getTableName, gt, inArray, max } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { clientCollectionNames } from './clientCollections';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { chunk } from './pushPlan';

export interface LiveRows {
  rows: any[];
  version: number; // the table's latest row_changes version these rows include
}

const FETCH_BATCH = 1000;

/**
 * The current rows of `table`. With the previous result, a synced table only fetches the rows that
 * changed since then, from its change log (row_changes, kept by triggers), so unchanged rows keep
 * their objects and a write to one of 50,000 assets costs one row. Other tables are small and are
 * read whole. Returns `previous` itself when nothing changed. Runs as one transaction, so no
 * write can land between reading the changes and the rows.
 */
export function readLiveRows(db: SyncDb, table: SQLiteTable, previous?: LiveRows): Promise<LiveRows> {
  const name = getTableName(table);
  return db.transaction(async (tx) => {
    const latest = await latestVersion(tx, name);
    if (!previous || !clientCollectionNames.includes(name))
      return { rows: await tx.select().from(table), version: latest };
    if (latest === previous.version) return previous;

    const changes = await tx
      .select({ rowId: schema.rowChanges.rowId })
      .from(schema.rowChanges)
      .where(and(eq(schema.rowChanges.tableName, name), gt(schema.rowChanges.version, previous.version)));
    const changedIds = new Set(changes.map((change) => change.rowId));

    const id = (getTableColumns(table) as Record<string, any>).id;
    const fetched = new Map<string, any>();
    for (const ids of chunk([...changedIds], FETCH_BATCH)) {
      for (const row of await tx.select().from(table).where(inArray(id, ids))) fetched.set(row.id, row);
    }

    // One pass: changed rows replace their old objects, changed ids that are gone were deleted, and
    // fetched rows that weren't there before are new.
    const rows: any[] = [];
    const replaced = new Set<string>();
    for (const row of previous.rows) {
      if (!changedIds.has(row.id)) rows.push(row);
      else if (fetched.has(row.id)) {
        rows.push(fetched.get(row.id));
        replaced.add(row.id);
      }
    }
    for (const [rowId, row] of fetched) if (!replaced.has(rowId)) rows.push(row);
    return { rows, version: latest };
  });
}

async function latestVersion(tx: SyncDb, tableName: string): Promise<number> {
  const [row] = await tx
    .select({ version: max(schema.rowChanges.version) })
    .from(schema.rowChanges)
    .where(eq(schema.rowChanges.tableName, tableName));
  return row?.version ?? 0;
}
