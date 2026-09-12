import type { AssetRecord } from '@squidbox/shared';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

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
// The AssetsProvider only mounts after the initial pull finishes (see AppGate), so this always
// reads the full table — no bulk-load pausing needed.
export function useLiveAssets(): AssetRow[] {
  const { data } = useLiveQuery(getDb().select().from(schema.assets));
  return data ?? [];
}

/** Live id-keyed map of all assets (matches the shape existing screens consume). */
export function useLiveAssetsMap(): Record<string, AssetRecord> {
  const rows = useLiveAssets();
  const map: Record<string, AssetRecord> = {};
  for (const row of rows) {
    const { syncError: _s, ...record } = row;
    map[row.id] = record as unknown as AssetRecord;
  }
  return map;
}
