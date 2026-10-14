import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { setCursor } from '../src/sync/status';
import { watchQuery } from '../src/sync/watchQuery';

let db: AppDb;
beforeEach(() => {
  db = makeTestDb();
});

type Row = { id: string; filename: string; isFavorite: boolean };
const readAssets = (db: AppDb): Promise<Row[]> =>
  db
    .select({ id: schema.assets.id, filename: schema.assets.filename, isFavorite: schema.assets.isFavorite })
    .from(schema.assets)
    .orderBy(schema.assets.id);

// Reads land on later ticks; a few turns of the event loop settle every pending one.
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
}

// A read that waits until the test releases it, counting its runs.
function gatedRead<T>(read: (db: AppDb) => Promise<T>) {
  let release = () => {};
  const gate = { runs: 0, release: () => release() };
  const gated = async (db: AppDb): Promise<T> => {
    gate.runs++;
    await new Promise<void>((resolve) => (release = resolve));
    return read(db);
  };
  return { gate, gated };
}

describe('watchQuery', () => {
  it('reads once enabled and again after a committed write to a watched table only', async () => {
    const results: Row[][] = [];
    const watch = watchQuery(db, readAssets, [schema.assets], (rows) => results.push(rows));
    await settle();
    expect(results).toEqual([]); // starts disabled
    watch.setEnabled(true);
    await settle();
    expect(results).toHaveLength(1);

    await setCursor(db, 7); // sync_meta: not watched
    await settle();
    expect(results).toHaveLength(1);

    await repo.createAsset(db, makeAssetRecord({ filename: 'a.jpg' }));
    await settle();
    expect(results).toHaveLength(2);
    expect(results[1]!.map((row) => row.filename)).toEqual(['a.jpg']);
    watch.stop();
  });

  it('coalesces writes during a read into one more read', async () => {
    const { gate, gated } = gatedRead(readAssets);
    const results: Row[][] = [];
    const watch = watchQuery(db, gated, [schema.assets], (rows) => results.push(rows));
    watch.setEnabled(true);
    await settle();
    expect(gate.runs).toBe(1);

    await repo.createAsset(db, makeAssetRecord({ filename: 'a.jpg' }));
    await repo.createAsset(db, makeAssetRecord({ filename: 'b.jpg' }));
    await settle();
    expect(gate.runs).toBe(1); // still the first read
    gate.release();
    await settle();
    expect(gate.runs).toBe(2); // one catch-up read for both writes
    gate.release();
    await settle();
    expect(gate.runs).toBe(2);
    expect(results).toHaveLength(2);
    expect(results[1]!.map((row) => row.filename).sort()).toEqual(['a.jpg', 'b.jpg']);
    watch.stop();
  });

  it('drops a read that lands after stop', async () => {
    const { gate, gated } = gatedRead(readAssets);
    const results: Row[][] = [];
    const watch = watchQuery(db, gated, [schema.assets], (rows) => results.push(rows));
    watch.setEnabled(true);
    await settle();
    watch.stop();
    gate.release();
    await settle();
    expect(gate.runs).toBe(1);
    expect(results).toEqual([]);

    await repo.createAsset(db, makeAssetRecord());
    await settle();
    expect(gate.runs).toBe(1);
  });

  it('keeps the objects of rows a write did not touch, and the whole result when nothing changed', async () => {
    const [a, b] = await repo.createAssets(db, [makeAssetRecord({ id: 'a' }), makeAssetRecord({ id: 'b' })]);
    const results: Row[][] = [];
    const watch = watchQuery(db, readAssets, [schema.assets], (rows) => results.push(rows));
    watch.setEnabled(true);
    await settle();

    await repo.toggleFavorite(db, b!.id);
    await settle();
    const [first, second] = results;
    expect(second).not.toBe(first);
    expect(second![0]).toBe(first![0]);
    expect(second![1]).not.toBe(first![1]);
    expect(second![1]!.isFavorite).toBe(true);

    await repo.updateAsset(db, a!.id, { notes: 'not a field the read selects' });
    await settle();
    expect(results).toHaveLength(3);
    expect(results[2]).toBe(second);
    watch.stop();
  });

  it('reuses the rows of the data a replaced watch delivered (a load-more, a changed query)', async () => {
    await repo.createAssets(db, [makeAssetRecord({ id: 'a' }), makeAssetRecord({ id: 'b' })]);
    const first: Row[][] = [];
    const firstWatch = watchQuery(
      db,
      (db) => readAssets(db).then((rows) => rows.slice(0, 1)),
      [schema.assets],
      (rows) => first.push(rows),
    );
    firstWatch.setEnabled(true);
    await settle();
    firstWatch.stop();

    const second: Row[][] = [];
    const secondWatch = watchQuery(db, readAssets, [schema.assets], (rows) => second.push(rows), first[0]);
    secondWatch.setEnabled(true);
    await settle();
    expect(second[0]![0]).toBe(first[0]![0]);
    expect(second[0]).toHaveLength(2);
    secondWatch.stop();
  });

  it('reuses nested rows and a { rows, count } result', async () => {
    await repo.createAssets(db, [makeAssetRecord({ id: 'a' }), makeAssetRecord({ id: 'b' })]);
    const read = async (db: AppDb) => {
      const rows = await readAssets(db);
      return {
        count: rows.length,
        posts: [{ id: 'p', postAssets: rows.map((asset) => ({ id: `e-${asset.id}`, asset })) }],
      };
    };
    const results: Awaited<ReturnType<typeof read>>[] = [];
    const watch = watchQuery(db, read, [schema.assets], (data) => results.push(data));
    watch.setEnabled(true);
    await settle();
    await repo.updateAsset(db, 'a', { notes: 'unselected field' });
    await settle();
    expect(results[1]).toBe(results[0]);

    await repo.toggleFavorite(db, 'b');
    await settle();
    const [first, , third] = results;
    expect(third).not.toBe(first);
    expect(third!.posts[0]!.postAssets[0]).toBe(first!.posts[0]!.postAssets[0]);
    expect(third!.posts[0]!.postAssets[1]!.asset.isFavorite).toBe(true);
    watch.stop();
  });

  it('skips reads while disabled and catches up once on enable, only if a write happened', async () => {
    const { gate, gated } = gatedRead(readAssets);
    const watch = watchQuery(db, gated, [schema.assets], () => {});
    await repo.createAsset(db, makeAssetRecord());
    await settle();
    expect(gate.runs).toBe(0);
    watch.setEnabled(true);
    gate.release();
    await settle();
    expect(gate.runs).toBe(1); // the first read, due since the start

    watch.setEnabled(false);
    await repo.createAsset(db, makeAssetRecord());
    await repo.createAsset(db, makeAssetRecord());
    await settle();
    expect(gate.runs).toBe(1);
    watch.setEnabled(true);
    gate.release();
    await settle();
    expect(gate.runs).toBe(2); // one catch-up read for both writes

    watch.setEnabled(false);
    watch.setEnabled(true);
    await settle();
    expect(gate.runs).toBe(2); // nothing happened meanwhile
    watch.stop();
  });

  it('notes a write that lands while a read is in flight for a disabled watch', async () => {
    const { gate, gated } = gatedRead(readAssets);
    const watch = watchQuery(db, gated, [schema.assets], () => {});
    watch.setEnabled(true);
    await settle();
    await repo.createAsset(db, makeAssetRecord());
    watch.setEnabled(false);
    gate.release();
    await settle();
    expect(gate.runs).toBe(1);
    watch.setEnabled(true);
    await settle();
    expect(gate.runs).toBe(2);
    gate.release();
    watch.stop();
  });
});
