import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { readLiveRows } from '../src/sync/readLiveRows';
import { resetLocalSync } from '../src/sync/worker';

let db: AppDb;
beforeEach(() => {
  db = makeTestDb();
});

describe('readLiveRows', () => {
  it('returns the previous result itself when nothing changed', async () => {
    await repo.createAsset(db, makeAssetRecord({ filename: 'a.jpg' }));
    const first = await readLiveRows(db, schema.assets);
    expect(await readLiveRows(db, schema.assets, first)).toBe(first);
  });

  it('fetches only changed and new rows; unchanged rows keep their objects', async () => {
    const a = await repo.createAsset(db, makeAssetRecord({ filename: 'a.jpg' }));
    const b = await repo.createAsset(db, makeAssetRecord({ filename: 'b.jpg' }));
    const first = await readLiveRows(db, schema.assets);
    const firstA = first.rows.find((row) => row.id === a.id);

    await repo.toggleFavorite(db, b.id);
    const c = await repo.createAsset(db, makeAssetRecord({ filename: 'c.jpg' }));
    const second = await readLiveRows(db, schema.assets, first);

    expect(second.rows.find((row) => row.id === a.id)).toBe(firstA);
    expect(second.rows.find((row) => row.id === b.id)?.isFavorite).toBe(!b.isFavorite);
    expect(second.rows.map((row) => row.id).sort()).toEqual([a.id, b.id, c.id].sort());
  });

  it('picks up the local-only syncError, which changes without updatedAt', async () => {
    const a = await repo.createAsset(db, makeAssetRecord({ filename: 'a.jpg' }));
    const first = await readLiveRows(db, schema.assets);
    await repo.setSyncError(db, a.id, 'upload failed');
    const second = await readLiveRows(db, schema.assets, first);
    expect(second.rows[0].syncError).toBe('upload failed');
  });

  it('drops deleted rows', async () => {
    await repo.createAsset(db, makeAssetRecord({ filename: 'a.jpg' }));
    const first = await readLiveRows(db, schema.assets);
    await resetLocalSync(db);
    expect((await readLiveRows(db, schema.assets, first)).rows).toEqual([]);
  });
});
