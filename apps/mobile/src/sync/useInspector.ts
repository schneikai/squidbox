import { sql } from 'drizzle-orm';

import { getDb } from './db/client';
import type { OutboxRow, SyncLogRow } from './db/schema';
import * as schema from './db/schema';
import { useLiveQuery } from './useLiveQuery';
import { useLiveTable } from './useLiveTable';

// Reactive data for the Sync Inspector: record counts in SQL, plus the small outbox and log tables.

export interface CollectionStats {
  name: string;
  records: number; // live (non-tombstoned)
  tombstones: number;
  pending: number;
}

const SYNC_LOG_SHOWN = 30;

export function useCollectionStats(): CollectionStats[] {
  const assets = useTombstoneCounts(schema.assets);
  const albums = useTombstoneCounts(schema.albums);
  const posts = useTombstoneCounts(schema.posts);
  const outbox = useLiveTable<OutboxRow>(schema.outbox) ?? [];

  const pendingByCollection = new Map<string, number>();
  for (const o of outbox) pendingByCollection.set(o.collection, (pendingByCollection.get(o.collection) ?? 0) + 1);

  const stat = (name: string, counts: { records: number; tombstones: number }): CollectionStats => ({
    name,
    ...counts,
    pending: pendingByCollection.get(name) ?? 0,
  });

  return [stat('assets', assets), stat('albums', albums), stat('posts', posts)];
}

// Live (non-tombstoned) and tombstoned row counts of a collection, counted in SQL.
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
    ) ?? [];
  return { records: Number(row?.records ?? 0), tombstones: Number(row?.tombstones ?? 0) };
}

export function useOutboxRows(): OutboxRow[] {
  return useLiveTable<OutboxRow>(schema.outbox) ?? [];
}

// The log is a ring buffer of at most 100 rows (status.ts), so reading all of it is cheap.
export function useSyncLogRows(): SyncLogRow[] {
  const rows = useLiveTable<SyncLogRow>(schema.syncLog) ?? [];
  return [...rows].sort((a, b) => b.id - a.id).slice(0, SYNC_LOG_SHOWN);
}
