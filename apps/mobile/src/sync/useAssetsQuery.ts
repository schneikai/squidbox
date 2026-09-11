import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { AssetRecord } from '@squidbox/shared';
import { getDb, schema } from './db/client';
import type { AssetRow } from './db/schema';

// Reactive reads. useLiveQuery re-runs when the SQLite tables change (requires the DB to be
// opened with enableChangeListener:true — see db/client.ts). This is the modern replacement
// for the in-memory provider map hydrated from JSON.

/**
 * Live array of ALL assets, including tombstoned ones. Screens filter by `deletedAt` (as they
 * used to filter by `isDeleted`) — keeping tombstones in the map preserves features like the
 * "Deleted" album.
 */
// `paused` skips loading the whole table while the initial bulk sync runs (the UI is gated behind
// FirstSyncScreen anyway). We query LIMIT 0 so useLiveQuery doesn't pull 15k rows into JS on every
// applied page; the deps=[paused] make it re-subscribe to the full query exactly once when sync ends.
export function useLiveAssets(paused = false): AssetRow[] {
  const q = paused
    ? getDb().select().from(schema.assets).limit(0)
    : getDb().select().from(schema.assets);
  const { data } = useLiveQuery(q, [paused]);
  return data ?? [];
}

/** Live id-keyed map of all assets (matches the shape existing screens consume). */
export function useLiveAssetsMap(paused = false): Record<string, AssetRecord> {
  const rows = useLiveAssets(paused);
  const map: Record<string, AssetRecord> = {};
  for (const row of rows) {
    const { syncError: _s, ...record } = row;
    map[row.id] = record as unknown as AssetRecord;
  }
  return map;
}
