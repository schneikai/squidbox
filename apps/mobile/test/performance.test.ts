import type { AssetRecord, PullResponse } from '@squidbox/shared';
import { describe, it, expect } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeMeasuredTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { readLiveRows } from '../src/sync/readLiveRows';
import type { SyncTransport } from '../src/sync/transport';
import { runSyncOnce } from '../src/sync/worker';

// Guards for what keeps a 50,000-asset library fast. They count work (statements, commits,
// rows read, full table scans) instead of timing it, so they are exact and don't flake: a change
// that makes a hot path grow with the library fails here.

const PAGE = 1000;

// Serves `records` as pull pages of 1,000, like the server, as the changes after cursor `start`.
function pullTransport(records: AssetRecord[], start = 0): SyncTransport {
  return {
    push: async () => ({ results: [] }),
    pull: async ({ cursor }): Promise<PullResponse> => {
      const page = records.slice(cursor - start, cursor - start + PAGE);
      const next = cursor + page.length;
      return { changes: { assets: { records: page } }, cursor: next, hasMore: next < start + records.length };
    },
  };
}

const makeAssets = (count: number) => Array.from({ length: count }, () => makeAssetRecord());

async function syncedLibrary(count: number) {
  const measured = makeMeasuredTestDb();
  const assets = makeAssets(count);
  await runSyncOnce(measured.db, pullTransport(assets));
  return { ...measured, assets };
}

describe('performance at library scale', () => {
  it('a first sync commits about 5,000 records per transaction', async () => {
    const { db, measure } = makeMeasuredTestDb();
    const empty = await measure(() => runSyncOnce(db, pullTransport([])));
    const first = await measure(() => runSyncOnce(db, pullTransport(makeAssets(12_000))));
    // 12 pages: 5 + 5 + 2, one transaction each, instead of one per page.
    expect(first.commits - empty.commits).toBe(2);
  });

  it('a first sync never scans the big tables', async () => {
    const { db, measure } = makeMeasuredTestDb();
    const work = await measure(() => runSyncOnce(db, pullTransport(makeAssets(3_000))));
    expect(work.fullScans.filter(isBigTableScan)).toEqual([]);
  });

  it('a favorite toggle and the live refresh after it cost the same at 1,000 and 10,000 assets', async () => {
    const costs = [];
    for (const count of [1_000, 10_000]) {
      const { db, measure, assets } = await syncedLibrary(count);
      const before = await readLiveRows(db, schema.assets);
      const work = await measure(async () => {
        await repo.toggleFavorite(db, assets[count / 2].id);
        await readLiveRows(db, schema.assets, before);
      });
      expect(work.fullScans.filter(isBigTableScan)).toEqual([]);
      costs.push(work);
    }
    const [small, large] = costs;
    expect(large.statements).toBe(small.statements);
    expect(large.rowsRead).toBe(small.rowsRead);
    expect(large.rowsRead).toBeLessThan(10);
  });

  it('a pull of 1,000 remote changes refreshes the live rows by reading only those', async () => {
    const { db, measure, assets } = await syncedLibrary(10_000);
    const before = await readLiveRows(db, schema.assets);
    const changed = assets.slice(0, PAGE).map((asset) => ({ ...asset, notes: 'edited', updatedAt: 2000 }));
    await runSyncOnce(db, pullTransport(changed, assets.length));
    const work = await measure(() => readLiveRows(db, schema.assets, before));
    expect(work.rowsRead).toBeLessThan(PAGE * 2 + 10); // the change-log ids and the rows, not 10,000
    expect(work.fullScans.filter(isBigTableScan)).toEqual([]);
  });

  it('a bulk write costs a few statements per 500 records, not several per record', async () => {
    const { db, measure, assets } = await syncedLibrary(2_000);
    const ids = assets.map((asset) => asset.id);
    const favorite = await measure(() =>
      repo.updateAssets(db, Object.fromEntries(ids.map((id) => [id, { isFavorite: true }]))),
    );
    const remove = await measure(() => repo.deleteAssets(db, ids));
    // per 500: read, upsert, outbox; plus BEGIN/COMMIT
    expect(favorite.statements).toBeLessThanOrEqual(2 + 3 * 4);
    expect(remove.statements).toBeLessThanOrEqual(2 + 3 * 4);
  });

  it('push results are applied in one transaction per batch of 500', async () => {
    const { db, measure, assets } = await syncedLibrary(1_000);
    await repo.updateAssets(db, Object.fromEntries(assets.map((asset) => [asset.id, { notes: 'edited' }])));
    const transport: SyncTransport = {
      push: async ({ mutations }) => ({
        results: mutations.map((m) => ({
          id: String((m.record as { id: string }).id),
          collection: m.collection,
          status: 'applied' as const,
        })),
      }),
      pull: async ({ cursor }) => ({ changes: {}, cursor, hasMore: false }),
    };
    const work = await measure(() => runSyncOnce(db, transport));
    expect(work.commits).toBeLessThanOrEqual(10); // one per push batch plus status and log writes, not one or more per result
  });

  it('adding to or removing from a big album reads only the edges it touches', async () => {
    const { db, measure } = makeMeasuredTestDb();
    const albums = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
    let n = 0;
    const newId = () => `edge-${++n}`;
    await albums.add(
      db,
      'album-1',
      Array.from({ length: 3_000 }, (_, i) => `asset-${i}`),
      newId,
    );
    const add = await measure(() => albums.add(db, 'album-1', ['new-asset'], newId));
    const remove = await measure(() => albums.remove(db, 'album-1', ['asset-7']));
    expect(add.rowsRead).toBeLessThan(10);
    expect(remove.rowsRead).toBeLessThan(10);
  });

  it('an idle sync pass leaves the sync state untouched except its status', async () => {
    const { db, assets } = await syncedLibrary(10);
    const written: string[][] = [];
    db.onTablesChanged((tables) => written.push([...tables]));
    await runSyncOnce(db, pullTransport(assets.slice(0, 0), assets.length));
    const metaWrites = written.filter((tables) => tables.includes('sync_meta')).length;
    expect(metaWrites).toBeLessThanOrEqual(2); // phase pulling → idle
  });
});

// Small tables (outbox, sync_meta, sync_log) may be scanned.
function isBigTableScan(detail: string): boolean {
  return /^SCAN (assets|albums|album_assets|posts|post_assets|row_changes)\b/.test(detail);
}
