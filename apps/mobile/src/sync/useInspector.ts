import { desc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { getDb, schema } from './db/client';
import type { AssetRow, OutboxRow, SyncLogRow } from './db/schema';

// Reactive data for the Sync Inspector. Kept as concrete per-table live queries (assets today;
// albums/posts added in 3b) plus outbox/log which are already collection-generic.

export interface CollectionStats {
  name: string;
  records: number; // live (non-tombstoned)
  tombstones: number;
  pending: number;
}

export function useCollectionStats(): CollectionStats[] {
  const { data: assets } = useLiveQuery(getDb().select().from(schema.assets));
  const { data: outbox } = useLiveQuery(getDb().select().from(schema.outbox));
  const rows: AssetRow[] = assets ?? [];
  const pendingByCollection = new Map<string, number>();
  for (const o of (outbox as OutboxRow[]) ?? []) {
    pendingByCollection.set(o.collection, (pendingByCollection.get(o.collection) ?? 0) + 1);
  }
  return [
    {
      name: 'assets',
      records: rows.filter((r) => r.deletedAt == null).length,
      tombstones: rows.filter((r) => r.deletedAt != null).length,
      pending: pendingByCollection.get('assets') ?? 0,
    },
  ];
}

export function useOutboxRows(): OutboxRow[] {
  const { data } = useLiveQuery(getDb().select().from(schema.outbox));
  return (data as OutboxRow[]) ?? [];
}

export function useSyncLogRows(): SyncLogRow[] {
  const { data } = useLiveQuery(getDb().select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(30));
  return (data as SyncLogRow[]) ?? [];
}
