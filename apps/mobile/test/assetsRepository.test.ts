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

  it('sets the sync error of many assets in one transaction', async () => {
    const { db, measure } = makeMeasuredTestDb();
    const assets = await repo.createAssets(
      db,
      Array.from({ length: 1_200 }, () => makeAssetRecord()),
    );
    const notifications: string[][] = [];
    db.onTablesChanged((tables) => notifications.push([...tables]));
    const work = await measure(() =>
      repo.setSyncError(
        db,
        assets.map((asset) => asset.id),
        'upload failed',
      ),
    );
    expect(work.commits).toBe(1);
    expect(notifications).toEqual([['assets']]);
  });
});
