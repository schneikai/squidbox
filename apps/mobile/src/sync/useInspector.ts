import { count, desc, sql } from 'drizzle-orm';

import { getDb } from './db/client';
import * as schema from './db/schema';
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

export function useCollectionStats(): CollectionStats[] {
  const assets = useTombstoneCounts(schema.assets);
  const albums = useTombstoneCounts(schema.albums);
  const posts = useTombstoneCounts(schema.posts);
  const pending =
    useLiveQuery(
      () =>
        getDb()
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

// Live (non-tombstoned) and tombstoned row counts of a collection.
function useTombstoneCounts(table: typeof schema.assets | typeof schema.albums | typeof schema.posts) {
  const [row] =
    useLiveQuery(
      () =>
        getDb()
          .select({
            records: sql<number>`count(*) filter (where ${table.deletedAt} is null)`,
            tombstones: sql<number>`count(*) filter (where ${table.deletedAt} is not null)`,
          })
          .from(table),
      [table],
    ) ?? NO_ROWS;
  return { records: Number(row?.records ?? 0), tombstones: Number(row?.tombstones ?? 0) };
}

export function useSyncLogRows(): schema.SyncLogRow[] {
  return (
    useLiveQuery(
      () => getDb().select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(SYNC_LOG_SHOWN),
      [schema.syncLog],
    ) ?? NO_ROWS
  );
}
