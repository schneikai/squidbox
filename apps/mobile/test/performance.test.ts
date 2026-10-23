import type { AlbumRecord, AssetRecord, PullResponse } from '@squidbox/shared';
import { initialKeys } from '@squidbox/shared';
import { describe, it, expect } from 'vitest';

import { makeAlbumRecord, makeAssetRecord, makePostRecord } from './helpers/factory';
import { makeMeasuredTestDb, type Work } from './helpers/testDb';
import albumQuery from '../src/features/album-list/albumQuery';
import assetQuery from '../src/features/asset-list/assetQuery';
import postQuery from '../src/features/post-list/postQuery';
import * as repo from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';
import type { SyncTransport } from '../src/sync/transport';
import { runSyncOnce } from '../src/sync/worker';
import { writeInBatches } from '../src/sync/writeInBatches';

// Guards for what keeps a 50,000-asset library fast. They count work (statements, commits,
// rows read, query-plan lines) instead of timing it, so they are exact and don't flake: a change
// that makes a hot path grow with the library fails here.

const PAGE = 1000;
const LIMIT = 150; // the grids' first page
const AL = 'album-1';
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
const postEdges = makeEdgeRepository('post_assets', schema.postAssets, 'postId');

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

// Accepts every pushed mutation, like the server does for a clean push.
const acceptingTransport: SyncTransport = {
  push: async ({ mutations }) => ({
    results: mutations.map((m) => ({
      id: String((m.record as { id: string }).id),
      collection: m.collection,
      status: 'applied' as const,
    })),
  }),
  pull: async ({ cursor }) => ({ changes: {}, cursor, hasMore: false }),
};

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

  it('a favorite toggle with the page re-read after it, and a load-more, read the same rows at 1,000 and 10,000 assets', async () => {
    const costs = [];
    for (const count of [1_000, 10_000]) {
      const { db, measure, assets } = await syncedLibrary(count);
      const q = assetQuery({ scope: 'library' });
      const toggle = await measure(async () => {
        await repo.toggleFavorite(db, assets[count / 2].id);
        await q.read(db, { limit: LIMIT });
      });
      const loadMore = await measure(() => q.read(db, { limit: LIMIT * 2 }));
      expectIndexedPlan(toggle);
      expectIndexedPlan(loadMore);
      costs.push({ toggle, loadMore });
    }
    const [small, large] = costs;
    expect(large.toggle.statements).toBe(small.toggle.statements);
    expect(large.toggle.rowsRead).toBe(small.toggle.rowsRead);
    expect(large.toggle.rowsRead).toBeLessThanOrEqual(LIMIT + 2); // the page, the count and the toggled row
    expect(large.loadMore.rowsRead).toBe(small.loadMore.rowsRead);
    expect(large.loadMore.rowsRead).toBeLessThanOrEqual(LIMIT * 2 + 1);
  });

  it('a custom album reads its own edges, not the library, at 1,000 and 5,000 edges', async () => {
    const costs = [];
    for (const count of [1_000, 5_000]) {
      const { db, measure, assets } = await syncedLibrary(count + 1_000);
      const keys = initialKeys(count);
      await albumEdges.createFromRefs(
        db,
        AL,
        assets.slice(0, count).map((asset, i) => ({ id: `edge-${keys[i]}`, assetId: asset.id })),
      );
      const q = assetQuery({ scope: { albumId: AL }, sort: 'custom' });
      const page = await measure(() => q.read(db, { limit: LIMIT }));
      const ids = await measure(() => q.ids(db));
      expectIndexedPlan(page);
      expectCanonicalEdgeProbe(page);
      expect(ids.rowsRead).toBe(count);
      costs.push(page);
    }
    const [small, large] = costs;
    expect(large.statements).toBe(small.statements);
    expect(large.rowsRead).toBe(small.rowsRead);
    expect(large.rowsRead).toBeLessThanOrEqual(LIMIT + 1);
  });

  it('a pull of 1,000 remote changes re-reads one page', async () => {
    const { db, measure, assets } = await syncedLibrary(10_000);
    const changed = assets.slice(0, PAGE).map((asset) => ({ ...asset, notes: 'edited', updatedAt: 2000 }));
    await runSyncOnce(db, pullTransport(changed, assets.length));
    const work = await measure(() => assetQuery({ scope: 'library' }).read(db, { limit: LIMIT }));
    expect(work.rowsRead).toBeLessThanOrEqual(LIMIT + 1);
    expectIndexedPlan(work);
  });

  it('a pushed write notifies the live reads once', async () => {
    const { db, assets } = await syncedLibrary(1_000);
    const notified: string[][] = [];
    db.onTablesChanged((tables) => notified.push([...tables]));
    await repo.updateMany(db, Object.fromEntries(assets.map((asset) => [asset.id, { notes: 'edited' }])));
    await runSyncOnce(db, acceptingTransport); // settles the push without an assets row changing
    expect(notified.filter((tables) => tables.includes('assets'))).toHaveLength(1);
  });

  it('a bulk delete is one transaction per 5,000 ids', async () => {
    const { db, measure, assets } = await syncedLibrary(12_000);
    const ids = assets.map((asset) => asset.id);
    const work = await measure(() => writeInBatches(ids, (batch) => repo.remove(db, batch)));
    expect(work.commits).toBe(3);
    expect((await assetQuery({ scope: 'deleted' }).read(db, { limit: 1 })).count).toBe(12_000);
  });

  it('a bulk write costs a few statements per 500 records, not several per record', async () => {
    const { db, measure, assets } = await syncedLibrary(2_000);
    const ids = assets.map((asset) => asset.id);
    const favorite = await measure(() =>
      repo.updateMany(db, Object.fromEntries(ids.map((id) => [id, { isFavorite: true }]))),
    );
    const remove = await measure(() => repo.remove(db, ids));
    // per 500: read, upsert, outbox; plus BEGIN/COMMIT
    expect(favorite.statements).toBeLessThanOrEqual(2 + 3 * 4);
    expect(remove.statements).toBeLessThanOrEqual(2 + 3 * 4);
  });

  it('push results are applied in one transaction per batch of 500', async () => {
    const { db, measure, assets } = await syncedLibrary(1_000);
    await repo.updateMany(db, Object.fromEntries(assets.map((asset) => [asset.id, { notes: 'edited' }])));
    const work = await measure(() => runSyncOnce(db, acceptingTransport));
    expect(work.commits).toBeLessThanOrEqual(10); // one per push batch plus status and log writes, not one or more per result
  });

  it('adding to or removing from a big album reads only the edges it touches', async () => {
    const { db, measure } = makeMeasuredTestDb();
    let n = 0;
    const newId = () => `edge-${++n}`;
    await albumEdges.add(
      db,
      AL,
      Array.from({ length: 3_000 }, (_, i) => `asset-${i}`),
      newId,
    );
    const add = await measure(() => albumEdges.add(db, AL, ['new-asset'], newId));
    const remove = await measure(() => albumEdges.remove(db, AL, ['asset-7']));
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

// The query plans the paged reads must keep (docs/paged-reads-plan.md §2): an ordered index walk
// and no sort of the whole scope, or, for the listed exemptions, exactly the plan they were measured
// with. A partial index silently stops being used when a predicate drifts; this is where it shows.
describe('plan guard', () => {
  async function library() {
    const { db, measure } = makeMeasuredTestDb();
    const assets = await repo.createMany(
      db,
      Array.from({ length: 30 }, (_, i) =>
        makeAssetRecord({
          createdAt: i,
          isFavorite: i % 3 === 0,
          mediaType: i % 4 === 0 ? 'video' : 'photo',
          notes: i % 2 === 0 ? `note ${i}` : null,
          deletedAt: i % 7 === 0 ? i : null,
        }),
      ),
    );
    const keys = initialKeys(10);
    await albumEdges.createFromRefs(
      db,
      AL,
      assets.slice(0, 10).map((asset, i) => ({ id: `edge-${keys[i]}`, assetId: asset.id })),
    );
    await makeRepository('posts', schema.posts).create(db, makePostRecord({ id: 'post-1', postedAt: 5 }));
    await postEdges.createFromRefs(db, 'post-1', [{ id: 'pe-1', assetId: assets[1].id }]);
    const album = (id: string, over: Partial<AlbumRecord> = {}) => makeAlbumRecord({ id, name: id, ...over });
    await makeRepository('albums', schema.albums).createMany(db, [
      album(AL),
      album('custom', { sortOrder: 'custom' }),
      album('favorites', { smartAlbumType: 'FAVORITES' }),
      album('deleted', { smartAlbumType: 'DELETED' }),
    ]);
    // Both the page and the ids read of a descriptor, as one plan.
    const plansOf = async (descriptor: Parameters<typeof assetQuery>[0]) => {
      const q = assetQuery(descriptor);
      const work = await measure(async () => {
        await q.read(db, { limit: LIMIT });
        await q.ids(db);
      });
      return work;
    };
    return { plansOf, measure, db };
  }

  it('walks an index in order for the date, custom and deleted reads, with and without filters', async () => {
    const { plansOf } = await library();
    const descriptors: Parameters<typeof assetQuery>[0][] = [
      { scope: 'library' },
      { scope: 'library', sort: 'createdAt:asc' },
      { scope: 'library', filter: ['favorites', 'images'] },
      { scope: 'favorites' },
      { scope: 'deleted' },
      { scope: { albumId: AL }, sort: 'custom' },
      { scope: { albumId: AL }, sort: 'custom', filter: ['videos'] },
    ];
    for (const descriptor of descriptors) expectIndexedPlan(await plansOf(descriptor), JSON.stringify(descriptor));
  });

  it('probes the asset index for the duplicate edges of a custom album, never the position index', async () => {
    const { plansOf } = await library();
    const work = await plansOf({ scope: { albumId: AL }, sort: 'custom' });
    expectCanonicalEdgeProbe(work);
    expect(work.plans).toContain('SEARCH e USING INDEX album_assets_album_position_idx (album_id=?)');
    expect(work.plans).toContain('SEARCH a USING INDEX sqlite_autoindex_assets_1 (id=?)');
    expect(work.plans).toContain('USE TEMP B-TREE FOR LAST TERM OF ORDER BY');
  });

  it('sorts by lastPostedAt with one correlated probe per row over the index walk', async () => {
    const { plansOf } = await library();
    const work = await plansOf({ scope: 'library', sort: 'lastPostedAt:desc' });
    expect(work.fullScans).toEqual(Array(3).fill('SCAN a USING INDEX assets_live_created_idx')); // count, rows, ids
    // One subquery per read (rows, ids): the order names the selected column instead of running it again.
    expect(work.plans.filter((line) => line.startsWith('CORRELATED SCALAR SUBQUERY'))).toHaveLength(2);
    expect(work.plans).toContain('SEARCH pe USING INDEX post_assets_asset_idx (asset_id=?)');
    expect(work.plans).toContain('SEARCH p USING INDEX sqlite_autoindex_posts_1 (id=?)');
    expect(work.plans).toContain('USE TEMP B-TREE FOR ORDER BY');
  });

  it('reads an album by date through its edges and sorts those, not the library', async () => {
    const { plansOf } = await library();
    const work = await plansOf({ scope: { albumId: AL } });
    expect(work.fullScans).toEqual([]);
    expect(work.plans).toContain('SEARCH album_assets USING INDEX album_assets_album_position_idx (album_id=?)');
    expect(work.plans).toContain('SEARCH a USING INDEX sqlite_autoindex_assets_1 (id=?)');
    expect(work.plans).toContain('USE TEMP B-TREE FOR ORDER BY');
  });

  it('searches the noted rows through their covering index, then the matched ids by key', async () => {
    const { plansOf } = await library();
    const work = await plansOf({ scope: 'library', search: 'note' });
    expect(work.fullScans.filter((line) => !line.startsWith('SCAN json_each'))).toEqual(
      Array(2).fill('SCAN a USING INDEX assets_notes_idx'), // once per read
    );
    expect(work.plans).toContain('SCAN json_each VIRTUAL TABLE INDEX 1:');
    expect(work.plans).toContain('SEARCH a USING INDEX sqlite_autoindex_assets_1 (id=?)');
    expect(work.plans).toContain('USE TEMP B-TREE FOR ORDER BY');
  });

  it('reads the album stats through one index per branch, never scanning the assets', async () => {
    const { measure, db } = await library();
    const work = await measure(() => albumQuery({ scope: 'all', assetSort: 'lastPostedAt:desc' }).read(db));
    // Not table scans: the albums themselves, the cover ids passed as JSON, each cover's one-row result.
    const scans = work.fullScans.filter((line) => line !== 'SCAN al' && !/^SCAN (json_each|\(subquery-)/.test(line));
    expect(scans).toEqual(
      Array(2).fill('SCAN a USING INDEX assets_live_created_idx'), // the Favorites count and cover: an ordered walk, once each
    );
    expect(work.plans).toContain('SEARCH a USING COVERING INDEX assets_deleted_idx (deleted_at>?)');
    expect(work.plans).toContain('SEARCH e USING INDEX album_assets_album_position_idx (album_id=?)');
    expect(work.plans).toContain('SEARCH album_assets USING INDEX album_assets_album_position_idx (album_id=?)');
    expect(work.plans).toContain('SEARCH pe USING INDEX post_assets_asset_idx (asset_id=?)');
    expectCanonicalEdgeProbe(work); // the custom cover
  });

  it('reads a post, and searches it, through its edges and the canonical probe, never the library', async () => {
    const { plansOf } = await library();
    const descriptors: Parameters<typeof assetQuery>[0][] = [
      { scope: { postId: 'post-1' } },
      { scope: { postId: 'post-1' }, search: 'note' },
    ];
    for (const descriptor of descriptors) {
      const work = await plansOf(descriptor);
      const context = JSON.stringify(descriptor);
      expect(
        work.fullScans.filter((line) => !line.startsWith('SCAN json_each')),
        context,
      ).toEqual([]);
      expect(work.plans, context).toContain('SEARCH e USING INDEX post_assets_post_idx (post_id=?)');
      expect(work.plans, context).toContain('SEARCH x USING INDEX post_assets_asset_idx (asset_id=? AND post_id=?)');
      expect(
        work.plans.filter((line) => /^SEARCH x\b/.test(line) && line.includes('position')),
        context,
      ).toEqual([]);
      expect(work.plans, context).toContain('SEARCH a USING INDEX sqlite_autoindex_assets_1 (id=?)');
    }
  });

  it('reads posts by postedAt through their index, their edges through the asset probe', async () => {
    const { measure, db } = await library();
    const work = await measure(() => postQuery({ scope: 'all' }).read(db, { limit: 20 }));
    expect(unindexedScans(work)).toEqual([]);
    expect(work.plans.filter((line) => line === 'USE TEMP B-TREE FOR ORDER BY')).toEqual([]);
    expect(work.plans).toContain('SCAN p USING INDEX posts_live_posted_idx');
    expect(work.plans).toContain('SEARCH e USING INDEX post_assets_post_idx (post_id=?)');
    expect(work.plans).toContain('SEARCH x USING INDEX post_assets_asset_idx (asset_id=? AND post_id=?)');
    expect(work.plans).toContain('SEARCH a USING INDEX sqlite_autoindex_assets_1 (id=?)');
  });

  it("reads each post's first asset in one windowed pass over the edges, through their indexes", async () => {
    const { measure, db } = await library();
    const work = await measure(() => postQuery({ scope: 'all' }).read(db, { limit: 20, firstAssetOnly: true }));
    // The window's own pass (a co-routine) is the only scan: the posts' edges, their canonical check
    // and the assets all go through indexes.
    const isWindowPass = (line: string) => /^SCAN (ranked|\(subquery-\d+\))$/.test(line);
    expect(unindexedScans(work).filter((line) => !isWindowPass(line))).toEqual([]);
    expect(work.plans).toContain('CO-ROUTINE ranked');
    expect(work.plans).toContain('SEARCH e USING INDEX post_assets_post_idx (post_id=?)');
    expect(work.plans).toContain('SEARCH x USING INDEX post_assets_asset_idx (asset_id=? AND post_id=?)');
    expect(work.plans).toContain('SEARCH a USING INDEX sqlite_autoindex_assets_1 (id=?)');
  });

  it('sorts the repost candidates and the ignored posts in a temp B-tree, posts being few', async () => {
    const { measure, db } = await library();
    for (const descriptor of [
      { scope: 'repostCandidates', sort: 'suggestRepostAt:asc' },
      { scope: 'ignored', sort: 'updatedAt:desc' },
    ] as Parameters<typeof postQuery>[0][]) {
      const work = await measure(() => postQuery(descriptor).read(db, { limit: 20 }));
      expect(work.plans, JSON.stringify(descriptor)).toContain('SCAN p USING INDEX posts_live_posted_idx');
      expect(work.plans, JSON.stringify(descriptor)).toContain('USE TEMP B-TREE FOR ORDER BY');
    }
  });

  it('draws a random sample with one full index walk', async () => {
    const { plansOf } = await library();
    const work = await plansOf({ scope: 'library', sort: 'random' });
    expect(work.fullScans).toEqual(Array(3).fill('SCAN a USING INDEX assets_live_created_idx'));
    expect(work.plans).toContain('USE TEMP B-TREE FOR ORDER BY');
  });
});

// Small tables (outbox, sync_meta, sync_log) may be scanned.
// The purged-files index holds only the sweep's work (sweepPurgedFiles), so a scan of it is no big scan.
function isBigTableScan(detail: string): boolean {
  return (
    /^SCAN (assets|albums|album_assets|posts|post_assets)\b/.test(detail) && !detail.includes('assets_purged_files_idx')
  );
}

// The table scans without an index; a list of ids passed as JSON (json_each) is the input, not a table.
function unindexedScans(work: Work): string[] {
  return work.fullScans.filter((line) => !/USING (COVERING )?INDEX/.test(line) && !line.startsWith('SCAN json_each'));
}

// Every table is walked through an index (an ordered walk prints as SCAN … USING INDEX) and nothing
// sorts the scope; a temp B-tree for the `id` tie-break alone is fine.
function expectIndexedPlan(work: Work, context = ''): void {
  expect(unindexedScans(work), context).toEqual([]);
  expect(
    work.plans.filter((line) => /TEMP B-TREE FOR (RIGHT PART OF )?ORDER BY/.test(line)),
    context,
  ).toEqual([]);
}

function expectCanonicalEdgeProbe(work: Work): void {
  expect(work.plans).toContain('SEARCH x USING INDEX album_assets_asset_idx (asset_id=? AND album_id=?)');
  expect(work.plans.filter((line) => /^SEARCH x\b/.test(line) && line.includes('position'))).toEqual([]);
}
