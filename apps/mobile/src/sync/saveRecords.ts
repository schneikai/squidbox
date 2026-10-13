/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { chunk, SQL_BATCH } from './chunk';
import type { SyncDb } from './db/types';
import { enqueueMutations } from './outbox';
import { upsertRows } from './upsertRows';

/**
 * A local write: store whole records of a collection and enqueue them for push. Call it inside the
 * transaction that read them, with records already given their next `updatedAt` (see clock.ts).
 * New records are inserted, so an id that already exists fails instead of overwriting that record.
 */
export async function saveRecords<R extends { id: string; updatedAt: number; deletedAt?: number | null }>(
  tx: SyncDb,
  collection: string,
  table: SQLiteTable,
  records: R[],
  { isNew = false } = {},
): Promise<void> {
  if (records.length === 0) return;
  if (isNew) for (const batch of chunk(records, SQL_BATCH)) await tx.insert(table).values(batch as any);
  else await upsertRows(tx, collection, table, records);
  await enqueueMutations(tx, collection, records);
}
