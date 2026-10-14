import { describe, it, expect } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeMeasuredTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';

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

  it('walks the unsynced assets by id and counts them, and the failed ones, through the partial indexes', async () => {
    const { db, measure } = makeMeasuredTestDb();
    await repo.createAssets(
      db,
      Array.from({ length: 7 }, (_, i) =>
        makeAssetRecord({ id: `a${i}`, isSynced: i % 2 === 1, deletedAt: i === 6 ? 1 : null }),
      ),
    );
    await repo.setSyncError(db, ['a4'], 'failed');
    let work = await measure(async () => expect(await repo.countUnsynced(db)).toBe(2)); // a0, a2
    expect(work.plans[0]).toMatch(/assets_unsynced_idx/);
    const first = await repo.readUnsynced(db, { afterId: null, limit: 1 });
    expect(first.map((a) => a.id)).toEqual(['a0']);
    work = await measure(async () =>
      expect((await repo.readUnsynced(db, { afterId: 'a0', limit: 50 })).map((a) => a.id)).toEqual(['a2']),
    );
    expect(work.plans[0]).toMatch(/assets_unsynced_idx/);
    expect(await repo.countSyncErrors(db)).toBe(1);
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
