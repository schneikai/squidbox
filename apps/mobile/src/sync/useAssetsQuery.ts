import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { AssetRecord } from '@squidbox/shared';
import { getDb, schema } from './db/client';
import type { AssetRow } from './db/schema';

// Reactive reads. useLiveQuery re-runs when the SQLite tables change (requires the DB to be
// opened with enableChangeListener:true — see db/client.ts). This is the modern replacement
// for the in-memory provider map hydrated from JSON.

/** Live array of non-tombstoned assets. */
export function useLiveAssets(): AssetRow[] {
  const { data } = useLiveQuery(getDb().select().from(schema.assets).where(isNull(schema.assets.deletedAt)));
  return data ?? [];
}

/** Live id-keyed map of non-tombstoned assets (matches the shape existing screens consume). */
export function useLiveAssetsMap(): Record<string, AssetRecord> {
  const rows = useLiveAssets();
  const map: Record<string, AssetRecord> = {};
  for (const row of rows) {
    const { syncError: _s, ...record } = row;
    map[row.id] = record as unknown as AssetRecord;
  }
  return map;
}
