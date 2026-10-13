import type { AssetRecord } from '@squidbox/shared';
import { isNull } from 'drizzle-orm';

import * as schema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';

/** All live (non-tombstoned) assets as synced records, id-keyed. */
export async function loadAssetsMap(db: SyncDb): Promise<Record<string, AssetRecord>> {
  const rows = await db.select().from(schema.assets).where(isNull(schema.assets.deletedAt));
  const map: Record<string, AssetRecord> = {};
  for (const { syncError: _syncError, ...record } of rows) map[record.id] = record as unknown as AssetRecord;
  return map;
}
