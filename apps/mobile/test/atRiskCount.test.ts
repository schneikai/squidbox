import { describe, it, expect } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import { readUnsyncedCounts } from '../src/library/atRiskCount';
import * as repo from '../src/sync/assetsRepository';

describe('readUnsyncedCounts', () => {
  it('counts outbox rows and photos not in the cloud, failed uploads included, deleted ones not', async () => {
    const db = makeTestDb();
    expect(await readUnsyncedCounts(db)).toEqual({
      pendingCount: 0,
      atRiskCount: 0,
      unsyncedCount: 0,
      syncErrorCount: 0,
    });

    const synced = await repo.createAsset(db, makeAssetRecord({ isSynced: true }));
    const unsynced = await repo.createAsset(db, makeAssetRecord({ isSynced: false }));
    const failed = await repo.createAsset(db, makeAssetRecord({ isSynced: false }));
    await repo.setSyncError(db, [failed.id], 'boom');
    const deleted = await repo.createAsset(db, makeAssetRecord({ isSynced: false }));
    await repo.deleteAssets(db, [deleted.id]);

    expect(await readUnsyncedCounts(db)).toEqual({
      pendingCount: 4,
      atRiskCount: 2,
      unsyncedCount: 1,
      syncErrorCount: 1,
    });
    expect([synced.id, unsynced.id]).toHaveLength(2);
  });
});
