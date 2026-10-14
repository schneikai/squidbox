import type { AssetRecord } from '@squidbox/shared';

import * as schema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';
import { readByIds } from '../../src/sync/readByIds';

/** One live (non-tombstoned) asset as a synced record, or undefined. */
export async function readLiveAsset(db: SyncDb, id: string): Promise<AssetRecord | undefined> {
  const [row] = await readByIds(db, schema.assets, [id]);
  if (!row || row.deletedAt != null) return undefined;
  const { syncError: _syncError, ...record } = row;
  return record as AssetRecord;
}
