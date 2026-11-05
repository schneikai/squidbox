import { count, desc, sql } from 'drizzle-orm';

import { clientCollectionTables } from './clientCollections';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { useLiveQuery } from './useLiveQuery';

// Reactive data for the Sync Inspector, counted and ordered in SQL.

export interface CollectionStats {
  name: string;
  records: number; // live (non-tombstoned)
  tombstones: number;
  pending: number;
}

const SYNC_LOG_SHOWN = 30;
const NO_ROWS: never[] = [];

const COLLECTIONS = Object.entries(clientCollectionTables);
const TABLES = COLLECTIONS.map(([, table]) => table);

// Every collection's live records and tombstones, read together.
function readCounts(db: SyncDb) {
  return Promise.all(
    COLLECTIONS.map(async ([name, table]) => {
      const [row] = await db
        .select({
          records: sql<number>`count(*) filter (where deleted_at is null)`,
          tombstones: sql<number>`count(*) filter (where deleted_at is not null)`,
        })
        .from(table);
      return { collection: name, records: Number(row?.records ?? 0), tombstones: Number(row?.tombstones ?? 0) };
    }),
  );
}

/** Each registered collection's records, tombstones and pending changes, in registry order. */
export function useCollectionStats(): CollectionStats[] {
  const counts = useLiveQuery(readCounts, TABLES) ?? NO_ROWS;
  const pending =
    useLiveQuery(
      (db) =>
        db
          .select({ collection: schema.outbox.collection, count: count() })
          .from(schema.outbox)
          .groupBy(schema.outbox.collection),
      [schema.outbox],
    ) ?? NO_ROWS;

  const countsByCollection = new Map(counts.map((row) => [row.collection, row]));
  const pendingByCollection = new Map(pending.map((row) => [row.collection, row.count]));
  return COLLECTIONS.map(([name]) => ({
    name,
    records: countsByCollection.get(name)?.records ?? 0,
    tombstones: countsByCollection.get(name)?.tombstones ?? 0,
    pending: pendingByCollection.get(name) ?? 0,
  }));
}

export function useSyncLogRows(): schema.SyncLogRow[] {
  return (
    useLiveQuery(
      (db) => db.select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(SYNC_LOG_SHOWN),
      [schema.syncLog],
    ) ?? NO_ROWS
  );
}
