import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { SyncDb } from './db/types';
import { enqueueMutations } from './outbox';
import { upsertRows } from './upsertRows';

/**
 * A local write: store whole records of a collection and enqueue them for push. Call it inside the
 * transaction that read them, with records already given their next `updatedAt` (see clock.ts).
 */
export async function saveRecords<R extends { id: string; updatedAt: number; deletedAt?: number | null }>(
  tx: SyncDb,
  collection: string,
  table: SQLiteTable,
  records: R[],
): Promise<void> {
  if (records.length === 0) return;
  await upsertRows(tx, collection, table, records);
  await enqueueMutations(tx, collection, records);
}
