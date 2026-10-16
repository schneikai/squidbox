import { describe, it, expect } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeMeasuredTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import { readByIds } from '../src/sync/readByIds';

describe('assetsRepository', () => {
  it('counts the photos and videos among the given ids in one statement', async () => {
    const { db, measure } = makeMeasuredTestDb();
    const assets = await repo.createAssets(db, [
      makeAssetRecord({ mediaType: 'photo' }),
      makeAssetRecord({ mediaType: 'video' }),
      makeAssetRecord({ mediaType: 'photo', deletedAt: 1 }),
      makeAssetRecord({ mediaType: 'photo' }),
    ]);
    const ids = [...assets.slice(0, 3).map((asset) => asset.id), 'unknown'];
    let counts: { photo: number; video: number } | undefined;
    const work = await measure(async () => (counts = await repo.countByMediaType(db, ids)));
    expect(counts).toEqual({ photo: 2, video: 1 });
    expect(work.statements).toBe(1);
    expect(await repo.countByMediaType(db, [])).toEqual({ photo: 0, video: 0 });
  });

  it('snapshots the ids to upload and counts them, and the failed ones, in one statement through the partial indexes', async () => {
    const { db, measure } = makeMeasuredTestDb();
    await repo.createAssets(
      db,
      Array.from({ length: 9 }, (_, i) =>
        makeAssetRecord({
          id: `a${i}`,
          isSynced: i % 2 === 1,
          deletedAt: i === 6 ? 1 : null,
          purgedAt: i === 8 ? 1 : null,
        }),
      ),
    );
    await repo.setSyncError(db, ['a4'], 'failed');
    let ids: string[] = [];
    let work = await measure(async () => (ids = await repo.readUnsyncedIds(db)));
    expect(ids).toEqual(['a0', 'a2']); // a4 failed, a6 deleted, a8 purged, the odd ones synced
    expect(work.plans.join()).toMatch(/assets_unsynced_idx/);
    const rows = await readByIds(db, schema.assets, ['a0', 'a1', 'a4', 'a6', 'a8']);
    expect(rows.filter(repo.isUnsynced).map((a) => a.id)).toEqual(['a0']); // the same rule in JS
    let counts;
    work = await measure(async () => (counts = await repo.readBackupCounts(db)));
    expect(counts).toEqual({ unsyncedCount: 2, syncErrorCount: 1 }); // a4 failed, a6 deleted not
    expect(work.statements).toBe(1);
    expect(work.plans.join()).toMatch(/assets_unsynced_idx/);
    expect(work.plans.join()).toMatch(/assets_sync_error_idx/);
    const errors = await repo.readSyncErrors(db, { limit: 10 });
    expect(errors.count).toBe(1);
    expect(errors.rows.map((a) => a.syncError)).toEqual(['failed']);
  });

  it('clears every sync error of the live assets in one statement', async () => {
    const { db, measure } = makeMeasuredTestDb();
    await repo.createAssets(db, [
      makeAssetRecord({ id: 'a1' }),
      makeAssetRecord({ id: 'a2' }),
      makeAssetRecord({ id: 'a3', deletedAt: 1 }),
    ]);
    await repo.setSyncError(db, ['a1', 'a2', 'a3'], 'upload failed');
    const notifications: string[][] = [];
    db.onTablesChanged((tables) => notifications.push([...tables]));
    const work = await measure(() => repo.clearSyncErrors(db));
    expect(work.statements).toBe(1);
    expect(notifications).toEqual([['assets']]);
    expect(await repo.countSyncErrors(db)).toBe(0);
    await repo.updateAssets(db, { a3: { deletedAt: null } });
    expect(await repo.countSyncErrors(db)).toBe(1); // a deleted asset keeps its error
  });
});
