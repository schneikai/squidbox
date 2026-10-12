import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { setCursor } from '../src/sync/status';

let db: AppDb;
let changes: string[][];
beforeEach(() => {
  db = makeTestDb();
  changes = [];
  db.onTablesChanged((tables) => changes.push([...tables].sort()));
});

describe('driver (createDb)', () => {
  it('runs a write issued during a transaction only after it commits', async () => {
    const order: string[] = [];
    const transaction = db.transaction(async (tx) => {
      await tx.insert(schema.assets).values({ ...makeAssetRecord({ filename: 'in-tx.jpg' }), syncError: null });
      await new Promise((resolve) => setTimeout(resolve, 10)); // give an outside write a chance to interleave
      order.push('transaction');
    });
    const outside = setCursor(db, 7).then(() => order.push('outside'));
    await Promise.all([transaction, outside]);
    expect(order).toEqual(['transaction', 'outside']);
  });

  it('notifies once per committed transaction, with the tables it wrote', async () => {
    await repo.createAsset(db, makeAssetRecord({ filename: 'a.jpg' })); // asset row + outbox row
    expect(changes).toEqual([['assets', 'outbox']]);
  });

  it('commits a bulk update as one unit', async () => {
    const [a, b] = await repo.createAssets(db, [makeAssetRecord(), makeAssetRecord()]);
    changes = [];
    await repo.updateAssets(db, { [a!.id]: { isFavorite: true }, [b!.id]: { isFavorite: true } });
    expect(changes).toEqual([['assets', 'outbox']]);
  });

  it('discards a rolled-back transaction without notifying', async () => {
    const failing = db.transaction(async (tx) => {
      await tx.insert(schema.assets).values({ ...makeAssetRecord({ filename: 'gone.jpg' }), syncError: null });
      throw new Error('boom');
    });
    await expect(failing).rejects.toThrow('boom');
    expect(await db.select().from(schema.assets)).toHaveLength(0);
    expect(changes).toEqual([]);
  });

  it('does not notify for reads', async () => {
    await db.select().from(schema.assets);
    expect(changes).toEqual([]);
  });
});
