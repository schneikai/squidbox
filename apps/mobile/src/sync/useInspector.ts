import { count, desc } from 'drizzle-orm';

import * as schema from './db/schema';
import { useLiveQuery } from './useLiveQuery';
import { useRecordCounts } from './useRecordCounts';

// Reactive data for the Sync Inspector, counted and ordered in SQL.

export interface CollectionStats {
  name: string;
  records: number; // live (non-tombstoned)
  tombstones: number;
  pending: number;
}

const SYNC_LOG_SHOWN = 30;
const NO_ROWS: never[] = [];

export function useCollectionStats(): CollectionStats[] {
  const assets = useRecordCounts(schema.assets);
  const albums = useRecordCounts(schema.albums);
  const posts = useRecordCounts(schema.posts);
  const pending =
    useLiveQuery(
      (db) =>
        db
          .select({ collection: schema.outbox.collection, count: count() })
          .from(schema.outbox)
          .groupBy(schema.outbox.collection),
      [schema.outbox],
    ) ?? NO_ROWS;

  const pendingByCollection = new Map(pending.map((row) => [row.collection, row.count]));
  const stat = (name: string, counts: { records: number; tombstones: number }): CollectionStats => ({
    name,
    ...counts,
    pending: pendingByCollection.get(name) ?? 0,
  });

  return [stat('assets', assets), stat('albums', albums), stat('posts', posts)];
}

export function useSyncLogRows(): schema.SyncLogRow[] {
  return (
    useLiveQuery(
      (db) => db.select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(SYNC_LOG_SHOWN),
      [schema.syncLog],
    ) ?? NO_ROWS
  );
}
