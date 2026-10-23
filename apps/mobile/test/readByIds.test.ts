import { describe, it, expect } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeMeasuredTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import { readByIdMap, readByIds } from '../src/sync/readByIds';

describe('readByIds', () => {
  it('reads the rows once each, in the order of the ids, tombstones included and unknown ids left out, in one statement', async () => {
    const { db, measure } = makeMeasuredTestDb();
    await repo.createMany(db, [
      makeAssetRecord({ id: 'a' }),
      makeAssetRecord({ id: 'b', deletedAt: 5 }),
      makeAssetRecord({ id: 'c' }),
    ]);
    let ids: string[] = [];
    const work = await measure(async () => {
      ids = (await readByIds<{ id: string }>(db, schema.assets, ['c', 'unknown', 'a', 'b', 'c'])).map((row) => row.id);
    });
    expect(ids).toEqual(['c', 'a', 'b']);
    expect(work.statements).toBe(1);
    expect(await readByIds(db, schema.assets, [])).toEqual([]);
  });

  it('reads them by id as a map', async () => {
    const { db } = makeMeasuredTestDb();
    await repo.createMany(db, [makeAssetRecord({ id: 'a' }), makeAssetRecord({ id: 'b' })]);
    const byId = await readByIdMap<{ id: string }>(db, schema.assets, ['b', 'b', 'x']);
    expect([...byId.keys()]).toEqual(['b']);
  });
});
