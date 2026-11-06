import { count, desc } from 'drizzle-orm';

import * as schema from './db/schema';
import { useLiveQuery } from './useLiveQuery';

// Reactive data for the Sync Inspector, counted and ordered in SQL.

const SYNC_LOG_SHOWN = 30;
const NO_ROWS: never[] = [];

/** Each collection's pending outbox rows, by collection name. */
export function usePendingByCollection(): Map<string, number> {
  const pending =
    useLiveQuery(
      (db) =>
        db
          .select({ collection: schema.outbox.collection, count: count() })
          .from(schema.outbox)
          .groupBy(schema.outbox.collection),
      [schema.outbox],
    ) ?? NO_ROWS;
  return new Map(pending.map((row) => [row.collection, row.count]));
}

export function useSyncLogRows(): schema.SyncLogRow[] {
  return (
    useLiveQuery(
      (db) => db.select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(SYNC_LOG_SHOWN),
      [schema.syncLog],
    ) ?? NO_ROWS
  );
}
