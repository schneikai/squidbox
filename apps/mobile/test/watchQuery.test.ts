import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeMeasuredTestDb, makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { setCursor } from '../src/sync/status';
import { watchQuery } from '../src/sync/watchQuery';

let db: AppDb;
beforeEach(() => {
  db = makeTestDb();
});

type Row = { id: string; filename: string; isFavorite: boolean };
const readAssets = (db: SyncDb): Promise<Row[]> =>
  db
    .select({ id: schema.assets.id, filename: schema.assets.filename, isFavorite: schema.assets.isFavorite })
    .from(schema.assets)
    .orderBy(schema.assets.id);

// Reads land on later ticks; a few turns of the event loop settle every pending one.
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
}

// A read that waits until the test releases it, counting its runs.
function gatedRead<T>(read: (db: SyncDb) => Promise<T>) {
  let release = () => {};
  const gate = { runs: 0, release: () => release() };
  const gated = async (db: SyncDb): Promise<T> => {
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

  it('says how fresh each result is: a read queued before a write is older than that write, even landing after it', async () => {
    const seen: number[] = [];
    const watch = watchQuery(db, readAssets, [schema.assets], (_rows, readAt) => seen.push(readAt));
    watch.setEnabled(true);
    await settle();
    expect(seen).toEqual([0]);

    // A read already queued, then a write: the read runs first, so it can't show the write.
    const queued = db.committedWrites();
    const read = db.transaction((tx) => tx.select({ id: schema.assets.id }).from(schema.assets));
    await repo.createAssets(db, [makeAssetRecord({ id: 'a' })]);
    const writtenAt = db.committedWrites();
    expect(await read).toEqual([]);
    expect(queued).toBeLessThan(writtenAt);
    await settle();
    // The watch's re-read after the write is at least as fresh as the write.
    expect(seen.at(-1)).toBeGreaterThanOrEqual(writtenAt);
    // A write that changes nothing isn't counted.
    await repo.setSyncError(db, ['missing'], 'x');
    expect(db.committedWrites()).toBe(writtenAt);
    watch.stop();
  });

  it('with waitForWrite, first reads after a write (the caller holds the data already)', async () => {
    const seen: Row[][] = [];
    const watch = watchQuery(db, readAssets, [schema.assets], (rows) => seen.push(rows), undefined, {
      waitForWrite: true,
    });
    watch.setEnabled(true);
    await settle();
    expect(seen).toEqual([]);
    await repo.createAssets(db, [makeAssetRecord({ id: 'a' })]);
    await settle();
    expect(seen.map((rows) => rows.map((row) => row.id))).toEqual([['a']]);
    watch.stop();
  });

  it("doesn't run a stopped watch's read still waiting in the db queue, nor log it", async () => {
    const measured = makeMeasuredTestDb();
    const errors = vi.spyOn(console, 'error');
    const { gate, gated } = gatedRead(async () => {});
    const busy = measured.db.transaction(gated); // holds the queue, like a long read or write
    const stale: Row[][] = [];
    const current: Row[][] = [];

    const work = await measured.measure(async () => {
      await settle();
      // A keystroke: a watch queues its read, the next keystroke replaces it before the queue gets there.
      const first = watchQuery(measured.db, readAssets, [schema.assets], (rows) => stale.push(rows));
      first.setEnabled(true);
      first.stop();
      const second = watchQuery(measured.db, readAssets, [schema.assets], (rows) => current.push(rows));
      second.setEnabled(true);
      gate.release();
      await busy;
      await settle();
      second.stop();
    });

    expect(stale).toEqual([]);
    expect(current).toHaveLength(1);
    expect(work.statements).toBe(3); // the transaction's begin and commit, and one read
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  describe('with minInterval', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('reads first and after a quiet write right away, and a burst of writes once per interval', async () => {
      const results: Row[][] = [];
      const watch = watchQuery(db, readAssets, [schema.assets], (rows) => results.push(rows), undefined, {
        minInterval: 1000,
      });
      watch.setEnabled(true);
      await settle();
      expect(results).toHaveLength(1); // the first read doesn't wait

      vi.advanceTimersByTime(2000);
      await repo.createAsset(db, makeAssetRecord({ filename: 'quiet.jpg' }));
      await settle();
      expect(results).toHaveLength(2); // a write after a quiet second shows right away

      for (let i = 0; i < 5; i++) {
        await repo.createAsset(db, makeAssetRecord({ filename: `burst${i}.jpg` }));
        await settle();
        vi.advanceTimersByTime(100);
      }
      expect(results).toHaveLength(2);
      vi.advanceTimersByTime(499);
      await settle();
      expect(results).toHaveLength(2);
      vi.advanceTimersByTime(1);
      await settle();
      expect(results).toHaveLength(3); // one read for the whole burst, a second after the last one began
      expect(results[2]).toHaveLength(6);

      await repo.createAsset(db, makeAssetRecord());
      watch.stop();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(1000);
      await settle();
      expect(results).toHaveLength(3); // a stopped watch's pending re-read is dropped
    });

    it('clears the pending re-read when disabled', async () => {
      const results: Row[][] = [];
      const watch = watchQuery(db, readAssets, [schema.assets], (rows) => results.push(rows), undefined, {
        minInterval: 1000,
      });
      watch.setEnabled(true);
      await settle();
      await repo.createAsset(db, makeAssetRecord());
      await settle();
      expect(vi.getTimerCount()).toBe(1); // the re-read waits for the interval

      watch.setEnabled(false);
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(1000);
      await settle();
      expect(results).toHaveLength(1);
      watch.stop();
    });

    it('catches up on enable right away', async () => {
      const { gate, gated } = gatedRead(readAssets);
      const watch = watchQuery(db, gated, [schema.assets], () => {}, undefined, { minInterval: 1000 });
      watch.setEnabled(true);
      gate.release();
      await settle();
      expect(gate.runs).toBe(1);

      watch.setEnabled(false);
      await repo.createAsset(db, makeAssetRecord());
      await settle();
      watch.setEnabled(true);
      await settle();
      expect(gate.runs).toBe(2); // within the interval, but a focus shows fresh data at once
      gate.release();
      watch.stop();
    });

    it('keeps the interval when enabled again while a read is in flight', async () => {
      const { gate, gated } = gatedRead(readAssets);
      const watch = watchQuery(db, gated, [schema.assets], () => {}, undefined, { minInterval: 1000 });
      watch.setEnabled(true);
      await settle();
      watch.setEnabled(false);
      watch.setEnabled(true); // a quick blur and focus while the first read runs
      await repo.createAsset(db, makeAssetRecord());
      gate.release();
      await settle();
      expect(gate.runs).toBe(1); // the write's re-read waits for the interval

      vi.advanceTimersByTime(1000);
      await settle();
      expect(gate.runs).toBe(2);
      gate.release();
      watch.stop();
    });
  });
});
