import type { AssetRow, OutboxRow, SyncLogRow } from './db/schema';
import * as schema from './db/schema';
import { useLiveTable } from './useLiveTable';

// Reactive data for the Sync Inspector. The tables are the same shared live reads the providers use,
// so opening the Inspector loads nothing extra.

export interface CollectionStats {
  name: string;
  records: number; // live (non-tombstoned)
  tombstones: number;
  pending: number;
}

const SYNC_LOG_SHOWN = 30;

export function useCollectionStats(): CollectionStats[] {
  const assets = useLiveTable<AssetRow>(schema.assets) ?? [];
  const albums = useLiveTable<{ deletedAt: number | null }>(schema.albums) ?? [];
  const posts = useLiveTable<{ deletedAt: number | null }>(schema.posts) ?? [];
  const outbox = useLiveTable<OutboxRow>(schema.outbox) ?? [];

  const pendingByCollection = new Map<string, number>();
  for (const o of outbox) pendingByCollection.set(o.collection, (pendingByCollection.get(o.collection) ?? 0) + 1);

  const stat = (name: string, rows: { deletedAt: number | null }[]): CollectionStats => ({
    name,
    records: rows.filter((r) => r.deletedAt == null).length,
    tombstones: rows.filter((r) => r.deletedAt != null).length,
    pending: pendingByCollection.get(name) ?? 0,
  });

  return [stat('assets', assets), stat('albums', albums), stat('posts', posts)];
}

export function useOutboxRows(): OutboxRow[] {
  return useLiveTable<OutboxRow>(schema.outbox) ?? [];
}

// The log is a ring buffer of at most 100 rows (status.ts), so reading all of it is cheap.
export function useSyncLogRows(): SyncLogRow[] {
  const rows = useLiveTable<SyncLogRow>(schema.syncLog) ?? [];
  return [...rows].sort((a, b) => b.id - a.id).slice(0, SYNC_LOG_SHOWN);
}
