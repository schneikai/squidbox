import type { PushMutation } from '@squidbox/shared';
import { deferred } from '@squidbox/shared/testing/deferred';
import { gate } from '@squidbox/shared/testing/gate';
import Database from 'better-sqlite3';
import { desc, eq } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { fakeTransport } from './helpers/fakeTransport';
import { makeTestDb } from './helpers/testDb';
import assetQuery from '../src/features/asset-list/assetQuery';
import postQuery from '../src/features/post-list/postQuery';
import * as repo from '../src/sync/assetsRepository';
import { createDb, type Execute } from '../src/sync/db/driver';
import journal from '../src/sync/db/migrations/meta/_journal.json';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';
import { clearFirstSyncDone, markFirstSyncDone, setMergeTarget, setOwner } from '../src/sync/status';
import { sweepPurgedFiles, type RemoveFiles } from '../src/sync/sweepPurgedFiles';
import { upsertRows } from '../src/sync/upsertRows';
import { fullResync, runSyncOnce } from '../src/sync/worker';

let db: SyncDb;
beforeEach(() => {
  db = makeTestDb();
});

const assetRow = (id: string) => db.select().from(schema.assets).where(eq(schema.assets.id, id)).get();

// A removeFiles that records the names it was given.
function recording() {
  const removed: string[] = [];
  return {
    removed,
    removeFiles: async (files: { filename?: string; thumbnailFilename?: string }[]) => {
      for (const { filename, thumbnailFilename } of files)
        removed.push(...[filename, thumbnailFilename].filter((n) => n !== undefined));
    },
  };
}

describe('Delete permanently', () => {
  it('purges the asset for good: out of the Deleted album and every album, its files once the server has it', async () => {
    const albums = makeRepository('albums', schema.albums);
    const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
    const asset = await repo.create(db, makeAssetRecord());
    const album = makeAlbumRecord();
    await albums.create(db, album);
    await albumEdges.add(db, album.id, [asset.id], () => 'edge-1');
    await repo.remove(db, [asset.id]);
    const trashedAt = (await assetRow(asset.id))!.deletedAt;
    expect(await assetQuery({ scope: 'deleted' }).ids(db)).toEqual([asset.id]);

    const purged = await repo.purgeAssets(db, [asset.id]);

    expect(purged.map((row) => row.id)).toEqual([asset.id]);
    const row = await assetRow(asset.id);
    expect(row?.purgedAt).not.toBeNull();
    expect(row?.deletedAt).toBe(trashedAt); // still deleted when it was trashed
    expect(await assetQuery({ scope: 'deleted' }).ids(db)).toEqual([]);
    expect(await assetQuery({ scope: { albumId: album.id } }).ids(db)).toEqual([]);
    const pending = await db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'assets'));
    expect(pending[0]?.payload).toMatchObject({ purgedAt: row?.purgedAt });
    expect(await repo.purgeAssets(db, [asset.id])).toEqual([]); // once purged, nothing more to do

    const { removed, removeFiles } = recording();
    await runSyncOnce(db, fakeTransport(), { removeFiles }); // the server applies it
    expect(removed).toEqual(['a.jpg', 't.jpg']);
    await runSyncOnce(db, fakeTransport(), { removeFiles });
    expect(removed).toEqual(['a.jpg', 't.jpg']);
  });

  it('removes only the names no other asset still uses, and again after a failed removal', async () => {
    const [mine, other, alsoPurged, before] = await repo.createMany(db, [
      makeAssetRecord({ filename: 'shared.jpg', thumbnailFilename: 'mine-t.jpg' }),
      makeAssetRecord({ filename: 'other.jpg', thumbnailFilename: 'shared.jpg' }), // a live asset naming it
      makeAssetRecord({ filename: 'both.jpg', thumbnailFilename: 'both-t.jpg' }),
      makeAssetRecord({ filename: 'both.jpg', thumbnailFilename: 'gone-t.jpg' }),
    ]);
    await repo.purgeAssets(db, [before!.id]); // a purged asset uses no name any more
    await runSyncOnce(db, fakeTransport(), { removeFiles: async () => {} });
    await repo.purgeAssets(db, [mine!.id, alsoPurged!.id]);

    const failure = new Error('disk full');
    await runSyncOnce(db, fakeTransport(), { removeFiles: async () => Promise.reject(failure) }); // not a failed run
    const [log] = await db.select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(1);
    expect(log).toMatchObject({ error: null, notes: expect.stringContaining('disk full') });
    expect((await assetRow(mine!.id))?.filesRemovedFor).toBeNull(); // still to remove: the next sweep does
    const { removed, removeFiles } = recording();
    await runSyncOnce(db, fakeTransport(), { removeFiles });
    expect((await assetRow(mine!.id))?.filesRemovedFor).toBe((await assetRow(mine!.id))?.purgedAt);
    expect(removed.sort()).toEqual(['both-t.jpg', 'both.jpg', 'mine-t.jpg']);
    expect((await assetRow(other!.id))?.purgedAt).toBeNull();
  });

  it('a purge that loses to a restore elsewhere keeps the files, and the asset comes back', async () => {
    const asset = await repo.create(db, makeAssetRecord({ deletedAt: 1000 }));
    await runSyncOnce(db, fakeTransport());
    await repo.purgeAssets(db, [asset.id]);
    const restored = { ...asset, deletedAt: null, purgedAt: null, updatedAt: Date.now() + 1000 };
    const { removed, removeFiles } = recording();
    const transport = fakeTransport({
      push: async (req) => ({
        results: req.mutations.map((m) => ({
          id: String(m.record.id),
          collection: m.collection,
          status: 'skipped-lww' as const,
          current: restored,
        })),
      }),
    });

    await runSyncOnce(db, transport, { removeFiles });

    expect(removed).toEqual([]);
    expect(await assetRow(asset.id)).toMatchObject({ deletedAt: null, purgedAt: null });
    expect(await db.select().from(schema.outbox)).toEqual([]);
  });

  it('a post shows a trashed asset but never a purged one', async () => {
    const [kept, gone] = await repo.createMany(db, [makeAssetRecord(), makeAssetRecord()]);
    await createPost(db, { id: 'p1' }, [kept!.id, gone!.id]);
    await repo.remove(db, [gone!.id]);
    const showing = async () =>
      (await postQuery({ scope: { postId: 'p1' } }).read(db, { limit: 1 })).rows[0].postAssets.map(
        (ref: { asset: { id: string } }) => ref.asset.id,
      );
    expect(await showing()).toEqual([kept!.id, gone!.id]); // a trashed asset can come back
    await repo.purgeAssets(db, [gone!.id]);
    expect(await showing()).toEqual([kept!.id]);
  });
});

describe('local files of a purge that arrives through sync', () => {
  const pulling = (records: Record<string, unknown>[]) =>
    fakeTransport({ pull: async () => ({ changes: { assets: { records } }, cursor: 5, hasMore: false }) });

  it('go when a pulled asset is purged, and stay while it is only in the Deleted album', async () => {
    const trashed = await repo.create(db, makeAssetRecord({ filename: 'trashed.jpg', thumbnailFilename: 'tt.jpg' }));
    const purged = await repo.create(db, makeAssetRecord({ filename: 'purged.jpg', thumbnailFilename: 'tt.jpg' }));
    await runSyncOnce(db, fakeTransport());
    const { removed, removeFiles } = recording();
    const transport = pulling([
      { ...trashed, deletedAt: 2000, purgedAt: null, updatedAt: 2000 },
      { ...purged, deletedAt: 2000, purgedAt: 3000, updatedAt: 3000 },
    ]);

    await runSyncOnce(db, transport, { removeFiles });

    expect(removed).toEqual(['purged.jpg']); // the thumbnail's name is the trashed asset's too
    expect((await assetRow(purged.id))?.purgedAt).toBe(3000);
  });

  it('cost nothing for an echo of a purge made here; an asset this device never had is swept once', async () => {
    const asset = await repo.create(db, makeAssetRecord());
    await repo.purgeAssets(db, [asset.id]);
    await runSyncOnce(db, fakeTransport(), { removeFiles: async () => {} });
    const { removed, removeFiles } = recording();
    const echo = { ...(await assetRow(asset.id)), notes: 'echo' };
    // Its files aren't here (a full resync can't tell it from one whose files are), so one removal that finds nothing.
    const unknown = makeAssetRecord({
      filename: 'u.jpg',
      thumbnailFilename: 'u-t.jpg',
      deletedAt: 2000,
      purgedAt: 2000,
      updatedAt: 2000,
    });

    await runSyncOnce(db, pulling([echo, unknown]), { removeFiles });
    await runSyncOnce(db, pulling([echo, unknown]), { removeFiles });

    expect(removed).toEqual(['u.jpg', 'u-t.jpg']);
    expect((await assetRow(asset.id))?.notes).toBe('echo');
  });

  it('a full resync still removes the files of an asset purged elsewhere meanwhile', async () => {
    const asset = await repo.create(db, makeAssetRecord({ filename: 'r.jpg', thumbnailFilename: 'r-t.jpg' }));
    await runSyncOnce(db, fakeTransport());
    const { removed, removeFiles } = recording();

    await fullResync(db, pulling([{ ...asset, deletedAt: 2000, purgedAt: 3000, updatedAt: 3000 }]), { removeFiles });

    expect((await assetRow(asset.id))?.purgedAt).toBe(3000);
    expect(removed).toEqual(['r.jpg', 'r-t.jpg']);
  });

  it('a purge pulled while this device’s own purge of it waits for its push: no removal then, once at the push', async () => {
    const asset = await repo.create(db, makeAssetRecord({ filename: 'w.jpg', thumbnailFilename: 'w-t.jpg' }));
    await repo.remove(db, [asset.id]);
    await runSyncOnce(db, fakeTransport());
    await repo.purgeAssets(db, [asset.id]);
    const { removed, removeFiles } = recording();
    const elsewhere = { ...(await assetRow(asset.id))!, purgedAt: 1, updatedAt: 3000 };
    const refused = fakeTransport({
      push: async (req) => ({
        results: req.mutations.map((m) => ({
          id: String(m.record.id),
          collection: m.collection,
          status: 'rejected' as const,
          reason: 'offline',
        })),
      }),
      pull: async () => ({ changes: { assets: { records: [elsewhere] } }, cursor: 5, hasMore: false }),
    });
    await runSyncOnce(db, refused, { removeFiles });
    expect(removed).toEqual([]);
    await db.update(schema.outbox).set({ error: null });
    const frozen = fakeTransport({
      push: async (req) => ({
        results: req.mutations.map((m) => ({
          id: String(m.record.id),
          collection: m.collection,
          status: 'skipped-lww' as const,
          current: elsewhere,
        })),
      }),
    });
    await runSyncOnce(db, frozen, { removeFiles });
    await runSyncOnce(db, fakeTransport(), { removeFiles });
    expect(removed).toEqual(['w.jpg', 'w-t.jpg']);
    expect(await assetRow(asset.id)).toMatchObject({ purgedAt: 1 });
    expect(await db.select().from(schema.outbox)).toEqual([]);
  });

  it('go when a purge beats this device’s own edit, which then adopts it', async () => {
    const asset = await repo.create(db, makeAssetRecord({ filename: 'mine.jpg', thumbnailFilename: 'mine-t.jpg' }));
    await runSyncOnce(db, fakeTransport());
    await repo.update(db, asset.id, { notes: 'edited offline' });
    const current = { ...asset, deletedAt: 3000, purgedAt: 3000, updatedAt: 3000 }; // purged on another device
    const { removed, removeFiles } = recording();
    const transport = fakeTransport({
      push: async (req) => ({
        results: req.mutations.map((m) => ({
          id: String(m.record.id),
          collection: m.collection,
          status: 'skipped-lww' as const,
          current,
        })),
      }),
    });

    await runSyncOnce(db, transport, { removeFiles });

    expect(removed).toEqual(['mine.jpg', 'mine-t.jpg']);
    expect(await assetRow(asset.id)).toMatchObject({ purgedAt: 3000, notes: null });
  });
});

describe('the sweep: crashes, shared names, resyncs, device libraries', () => {
  const applied = fakeTransport();
  const refused = fakeTransport({
    push: async (req) => ({
      results: req.mutations.map((m) => ({
        id: String(m.record.id),
        collection: m.collection,
        status: 'rejected' as const,
        reason: 'schema:notes',
      })),
    }),
  });
  async function trashed(over: Record<string, unknown>) {
    const asset = await repo.create(db, makeAssetRecord(over));
    await repo.remove(db, [asset.id]);
    return asset;
  }

  it('a removal that fails after the files went: the next sweep removes them again and marks them once', async () => {
    const asset = await trashed({ filename: 'c.jpg', thumbnailFilename: 'c-t.jpg' });
    await repo.purgeAssets(db, [asset.id]);
    const { removed, removeFiles } = recording();
    // The files go, then the removal reports an error.
    await runSyncOnce(db, applied, {
      removeFiles: async (files) => {
        await removeFiles(files);
        throw new Error('killed');
      },
    });
    expect((await assetRow(asset.id))?.filesRemovedFor).toBeNull();
    const before = removed.length;
    await sweepPurgedFiles(db, removeFiles); // the next launch
    await sweepPurgedFiles(db, removeFiles);
    expect(removed.slice(before)).toEqual(['c.jpg', 'c-t.jpg']); // a removal that finds nothing, once
    expect((await assetRow(asset.id))?.filesRemovedFor).not.toBeNull();
  });

  it('an asset whose files can’t be removed holds up no other, and waits for the next sweep', async () => {
    const assets = [];
    for (const name of ['a', 'b', 'bad', 'c', 'd'])
      assets.push(await trashed({ filename: `${name}.jpg`, thumbnailFilename: `${name}-t.jpg` }));
    await repo.purgeAssets(
      db,
      assets.map((asset) => asset.id),
    );
    const { removed, removeFiles } = recording();
    const failing: RemoveFiles = async (files) => {
      if (files.some((file) => file.filename === 'bad.jpg')) throw new Error('busy');
      await removeFiles(files);
    };
    await runSyncOnce(db, applied, { removeFiles: failing });
    expect([...new Set(removed)].sort()).toEqual([
      'a-t.jpg',
      'a.jpg',
      'b-t.jpg',
      'b.jpg',
      'c-t.jpg',
      'c.jpg',
      'd-t.jpg',
      'd.jpg',
    ]);
    const [log] = await db.select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(1);
    expect(log).toMatchObject({ error: null, notes: expect.stringContaining('1 purged assets: busy') });
    removed.length = 0;
    await sweepPurgedFiles(db, removeFiles);
    expect(removed).toEqual(['bad.jpg', 'bad-t.jpg']);
  });

  it('a sweep stops between batches once its signal aborts', async () => {
    const asset = await trashed({ filename: 's.jpg', thumbnailFilename: 's-t.jpg' });
    await repo.purgeAssets(db, [asset.id]);
    await runSyncOnce(db, applied);
    const { removed, removeFiles } = recording();
    await sweepPurgedFiles(db, removeFiles, { signal: AbortSignal.abort() });
    expect(removed).toEqual([]);
    await sweepPurgedFiles(db, removeFiles);
    expect(removed).toEqual(['s.jpg', 's-t.jpg']);
  });

  it('a name shared by a confirmed purge, a pending purge, a trashed and a live photo goes with the last of them', async () => {
    const confirmed = await trashed({ filename: 'f.jpg', thumbnailFilename: 'confirmed-t.jpg' });
    const pending = await trashed({ filename: 'f.jpg', thumbnailFilename: 'g.jpg' });
    const inTrash = await trashed({ filename: 'trash.jpg', thumbnailFilename: 'g.jpg' });
    const live = await repo.create(db, makeAssetRecord({ filename: 'live.jpg', thumbnailFilename: 'confirmed-t.jpg' }));
    await runSyncOnce(db, applied);
    await repo.purgeAssets(db, [confirmed.id]);
    await runSyncOnce(db, applied); // confirmed
    await repo.purgeAssets(db, [pending.id]); // waits: its push is refused
    const { removed, removeFiles } = recording();
    await runSyncOnce(db, refused, { removeFiles });
    expect(removed).toEqual([]); // f.jpg: the pending purge's; confirmed-t.jpg: the live photo's
    await repo.purgeAssets(db, [inTrash.id]);
    await runSyncOnce(db, applied, { removeFiles }); // the refused row waits (its error)
    expect(removed).toEqual(['trash.jpg']); // g.jpg: still the pending purge's
    await db.update(schema.outbox).set({ error: null });
    await runSyncOnce(db, applied, { removeFiles });
    expect(removed.sort()).toEqual(['f.jpg', 'g.jpg', 'trash.jpg']);
    await repo.remove(db, [live.id]);
    await repo.purgeAssets(db, [live.id]);
    await runSyncOnce(db, applied, { removeFiles });
    expect(removed.sort()).toEqual(['confirmed-t.jpg', 'f.jpg', 'g.jpg', 'live.jpg', 'trash.jpg']);
  });

  it('without an account a pending purge counts as done, but a trashed or live photo still keeps a shared name', async () => {
    await setOwner(db, { kind: 'device' });
    const a = await trashed({ filename: 'f.jpg', thumbnailFilename: 'a-t.jpg' });
    const b = await trashed({ filename: 'f.jpg', thumbnailFilename: 'b-t.jpg' });
    await trashed({ filename: 'other.jpg', thumbnailFilename: 'a-t.jpg' });
    await repo.purgeAssets(db, [a.id, b.id]);
    const { removed, removeFiles } = recording();
    await sweepPurgedFiles(db, removeFiles);
    expect([...new Set(removed)].sort()).toEqual(['b-t.jpg', 'f.jpg']);
  });

  it('a device library a merge pass copied into an account keeps a pending purge’s files, as an account does', async () => {
    await setOwner(db, { kind: 'device' });
    await setMergeTarget(db, { library: 'account', serverId: 's1', userId: 'u1' });
    const asset = await trashed({ filename: 'm.jpg', thumbnailFilename: 'm-t.jpg' });
    await repo.purgeAssets(db, [asset.id]);
    const { removed, removeFiles } = recording();
    await sweepPurgedFiles(db, removeFiles);
    expect(removed).toEqual([]);
    await setMergeTarget(db, null); // a merge that keeps the source is done
    await sweepPurgedFiles(db, removeFiles);
    expect(removed).toEqual(['m.jpg', 'm-t.jpg']);
  });

  it('nothing is swept until the library is fully pulled again (a full resync clears the first-sync flag)', async () => {
    const asset = await trashed({ filename: 'n.jpg', thumbnailFilename: 'n-t.jpg' });
    await runSyncOnce(db, applied);
    await upsertRows(db, 'assets', schema.assets, [{ ...(await assetRow(asset.id))!, purgedAt: 3000 }]); // pulled
    await clearFirstSyncDone(db);
    const { removed, removeFiles } = recording();
    await sweepPurgedFiles(db, removeFiles);
    expect(removed).toEqual([]);
    await runSyncOnce(db, applied, { removeFiles }); // the pull drains
    expect(removed).toEqual(['n.jpg', 'n-t.jpg']);
  });

  it('a sync run without removeFiles leaves the files and their mark for a run with it', async () => {
    const asset = await trashed({ filename: 'r.jpg', thumbnailFilename: 'r-t.jpg' });
    await repo.purgeAssets(db, [asset.id]);
    await runSyncOnce(db, applied);
    expect((await assetRow(asset.id))?.filesRemovedFor).toBeNull();
    const { removed, removeFiles } = recording();
    await runSyncOnce(db, applied, { removeFiles });
    expect(removed).toEqual(['r.jpg', 'r-t.jpg']);
  });

  it('a rejected edit waiting on an asset purged elsewhere: the pull brings the purge and its files go', async () => {
    const asset = await repo.create(db, makeAssetRecord({ filename: 'r.jpg', thumbnailFilename: 'r-t.jpg' }));
    await runSyncOnce(db, applied);
    await repo.update(db, asset.id, { notes: 'bad' });
    const { removed, removeFiles } = recording();
    const purged = { ...asset, deletedAt: 2000, purgedAt: 3000, updatedAt: 3000 };
    await runSyncOnce(
      db,
      fakeTransport({
        ...refused,
        pull: async () => ({ changes: { assets: { records: [purged] } }, cursor: 9, hasMore: false }),
      }),
      {
        removeFiles,
      },
    );
    expect(await assetRow(asset.id)).toMatchObject({ purgedAt: 3000, notes: 'bad' });
    expect(removed).toEqual(['r.jpg', 'r-t.jpg']);
    expect((await db.select().from(schema.outbox))[0]?.error).toBe('schema:notes');
  });

  // The sweep trusts the local table, which a full resync empties: a name a purged photo on the first
  // page shares with a live photo not pulled back yet would count as unused. So nothing is swept until
  // the resync has drained (the first-sync flag), even when it stops after a page (a sign-out, a
  // library switch: withSyncPaused) or the app is killed in it (the sweep at the library's next open).
  it('a full resync stopped after its first page keeps a name a live photo not pulled back yet uses', async () => {
    const purged = await trashed({ filename: 'shared.jpg', thumbnailFilename: 'p-t.jpg' });
    const live = await repo.create(
      db,
      makeAssetRecord({ filename: 'shared.jpg', thumbnailFilename: 'l-t.jpg', isFileSynced: false, isSynced: false }),
    );
    await runSyncOnce(db, applied);
    const firstPage = { ...(await assetRow(purged.id))!, purgedAt: 3000, updatedAt: 3000 };
    const { syncError: _e, filesRemovedFor: _f, ...wire } = firstPage;
    const secondPage = await assetRow(live.id);
    const stop = new AbortController();
    const { removed, removeFiles } = recording();
    await fullResync(
      db,
      fakeTransport({
        pull: async ({ cursor }) => {
          if (cursor === 0) {
            stop.abort(); // the run is paused while the first page downloads
            return { changes: { assets: { records: [wire] } }, cursor: 1, hasMore: true };
          }
          return { changes: { assets: { records: [secondPage] } }, cursor: 2, hasMore: false };
        },
      }),
      { removeFiles, signal: stop.signal },
    );
    expect(removed).toEqual([]);
    await sweepPurgedFiles(db, removeFiles); // the library opens again
    expect(removed).toEqual([]);
    await runSyncOnce(
      db,
      fakeTransport({
        pull: async () => ({ changes: { assets: { records: [secondPage] } }, cursor: 2, hasMore: false }),
      }),
      { removeFiles },
    );
    expect(removed).toEqual(['p-t.jpg']); // shared.jpg: the live photo's, back
  });
});

describe('the sweep: concurrent sweeps, aborts, stuck assets, resyncs', () => {
  const applied = fakeTransport();
  async function trashed(over: Record<string, unknown>) {
    const asset = await repo.create(db, makeAssetRecord(over));
    await repo.remove(db, [asset.id]);
    return asset;
  }
  async function manyPurged(n: number, name: (i: number) => { filename: string; thumbnailFilename: string }) {
    const records = Array.from({ length: n }, (_, i) => makeAssetRecord(name(i)));
    await repo.createMany(db, records);
    const ids = records.map((record) => record.id);
    await repo.remove(db, ids);
    await repo.purgeAssets(db, ids);
    await runSyncOnce(db, applied);
    return ids;
  }
  const unswept = async () =>
    (await db.select().from(schema.assets)).filter(
      (row) => row.purgedAt !== null && row.filesRemovedFor !== row.purgedAt,
    );

  it('two sweeps at once (the open’s and a run’s) remove each name, mark every asset, and neither throws', async () => {
    await manyPurged(1200, (i) => ({ filename: `f${i % 700}.jpg`, thumbnailFilename: `t${i}.jpg` }));
    const removed: string[] = [];
    // The first removal of each sweep waits until all three are inside one: they remove the same batch.
    let calls = 0;
    const allInside = deferred();
    const together: RemoveFiles = async (files) => {
      if (++calls === 3) allInside.resolve();
      await allInside.promise;
      for (const { filename, thumbnailFilename } of files)
        removed.push(...[filename, thumbnailFilename].filter((n) => n !== undefined));
    };
    const sweeps = [
      sweepPurgedFiles(db, together),
      runSyncOnce(db, applied, { removeFiles: together }),
      sweepPurgedFiles(db, together),
    ];
    // One that ends without a removal opens the barrier too, so the count below fails instead of a hang.
    Promise.race(sweeps).then(allInside.resolve, allInside.resolve);
    let reached = 0;
    allInside.promise.then(() => (reached = calls));
    await Promise.all(sweeps);
    expect(reached).toBe(3); // all three were inside a removal at once
    expect(await unswept()).toEqual([]);
    expect(new Set(removed).size).toBe(700 + 1200);
    const [log] = await db.select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(1);
    expect(log).toMatchObject({ error: null });
  });

  it('an abort during a batch’s removal marks what went, then stops; the next sweep finishes', async () => {
    await manyPurged(1100, (i) => ({ filename: `g${i}.jpg`, thumbnailFilename: `gt${i}.jpg` }));
    const stop = new AbortController();
    const removed: string[] = [];
    const removeFiles: RemoveFiles = async (files) => {
      stop.abort(); // the library closes while the first batch's files go
      for (const { filename, thumbnailFilename } of files)
        removed.push(...[filename, thumbnailFilename].filter((n) => n !== undefined));
    };
    await sweepPurgedFiles(db, removeFiles, { signal: stop.signal });
    expect(removed).toHaveLength(1000);
    expect(await unswept()).toHaveLength(600);
    await sweepPurgedFiles(db, removeFiles);
    expect(await unswept()).toEqual([]);
    expect(new Set(removed).size).toBe(2200);
  });

  it('an asset that keeps failing among assets sharing its names: the others are marked, the shared name goes once its last user is swept', async () => {
    const ids = await manyPurged(5, (i) => ({
      filename: 'same.jpg',
      thumbnailFilename: i === 2 ? 'stuck.jpg' : `s${i}.jpg`,
    }));
    const live = await repo.create(db, makeAssetRecord({ filename: 'other.jpg', thumbnailFilename: 'stuck.jpg' }));
    await runSyncOnce(db, applied);
    const removed: string[] = [];
    const removeFiles: RemoveFiles = async (files) => {
      if (files.some((file) => file.filename === 'same.jpg' && file.thumbnailFilename === undefined))
        throw new Error('locked');
      for (const { filename, thumbnailFilename } of files)
        removed.push(...[filename, thumbnailFilename].filter((n) => n !== undefined));
    };
    await expect(sweepPurgedFiles(db, removeFiles)).rejects.toThrow('1 purged assets: locked');
    expect((await unswept()).map((row) => row.id)).toEqual([ids[2]]);
    expect(removed).not.toContain('stuck.jpg'); // the live photo's
    await repo.remove(db, [live.id]);
    await repo.purgeAssets(db, [live.id]);
    await runSyncOnce(db, applied);
    await sweepPurgedFiles(db, async (files) => {
      for (const { filename, thumbnailFilename } of files)
        removed.push(...[filename, thumbnailFilename].filter((n) => n !== undefined));
    });
    expect(await unswept()).toEqual([]);
    expect(removed).toContain('stuck.jpg');
  });

  // A sweep asks per batch whether purges are confirmed: a full resync that wipes the tables and pulls
  // its first page between two batches leaves nothing confirmed until it drains, so the shared-name
  // check never runs against a half-pulled table. (An account library sweeps inside the sync queue
  // anyway, where no resync interleaves.)
  it('a full resync between two batches of a sweep already running: nothing more is swept until it drains', async () => {
    const first = await trashed({
      id: '00000000-0000-4000-8000-000000000001',
      filename: 'p1.jpg',
      thumbnailFilename: 'p1-t.jpg',
    });
    const later = await trashed({
      id: 'ffffffff-0000-4000-8000-000000000001',
      filename: 'shared.jpg',
      thumbnailFilename: 'p2-t.jpg',
    });
    const live = await repo.create(
      db,
      makeAssetRecord({ filename: 'shared.jpg', thumbnailFilename: 'l-t.jpg', isFileSynced: false, isSynced: false }),
    );
    await repo.purgeAssets(db, [first.id]);
    await runSyncOnce(db, applied); // confirmed, fully pulled
    // Purged on another device meanwhile: the resync's first page brings it.
    const {
      syncError: _e,
      filesRemovedFor: _f,
      ...laterPurged
    } = {
      ...(await assetRow(later.id))!,
      purgedAt: 3000,
      updatedAt: 3000,
    };
    const liveRow = await assetRow(live.id);

    const removed: string[] = [];
    const firstBatch = gate();
    let calls = 0;
    const sweep = sweepPurgedFiles(db, async (files) => {
      if (calls++ === 0) await firstBatch.hold(); // the first batch's files take a while to go
      for (const { filename, thumbnailFilename } of files)
        removed.push(...[filename, thumbnailFilename].filter((n) => n !== undefined));
    });
    await firstBatch.entered;
    expect(calls).toBe(1);

    const stop = new AbortController();
    await fullResync(
      db,
      fakeTransport({
        pull: async ({ cursor }) => {
          if (cursor === 0) {
            stop.abort(); // paused after the first page (a sign-out, a switch) or simply still pulling
            return { changes: { assets: { records: [laterPurged] } }, cursor: 1, hasMore: true };
          }
          return { changes: { assets: { records: [liveRow] } }, cursor: 2, hasMore: false };
        },
      }),
      { signal: stop.signal },
    );
    firstBatch.release();
    await sweep;
    expect(removed).not.toContain('shared.jpg');
  });
});

describe('migration 0012_purged_files on a database at 0011', () => {
  const migrationsFolder = fileURLToPath(new URL('../src/sync/db/migrations', import.meta.url));
  const migrations = readMigrationFiles({ migrationsFolder });
  const at = (tag: string) => journal.entries.findIndex((entry) => entry.tag === tag);
  const run = (sqlite: Database.Database, from: number, to: number) => {
    for (const migration of migrations.slice(from, to)) for (const statement of migration.sql) sqlite.exec(statement);
  };
  const executor =
    (sqlite: Database.Database): Execute =>
    async (sql, params, method) => {
      const statement = sqlite.prepare(sql);
      if (method === 'run') return { rows: [], changes: statement.run(...params).changes };
      const rows = statement.raw().all(...params);
      return { rows: method === 'get' ? (rows[0] as unknown[]) : rows };
    };
  // The installed app's database: an asset purged offline (its files already removed, as that app
  // does at once) with its whole-record outbox row, one purged and pushed, one live with a pending
  // notes edit, one trashed.
  function installedAppDb() {
    const sqlite = new Database(':memory:');
    run(sqlite, 0, at('0011_outbox_fields'));
    const insert = sqlite.prepare(
      `INSERT INTO assets (id, created_at, updated_at, deleted_at, media_library_asset_id, media_type, width, height,
        file_size, duration, filename, thumbnail_filename, is_favorite, notes, old_file_id, is_file_synced,
        is_thumbnail_synced, is_synced, purged_at) VALUES (?, 1000, ?, ?, 'm', 'photo', 1, 1, 1, NULL, ?, ?, 0, NULL, NULL, 1, 1, 1, ?)`,
    );
    insert.run('offline', 2000, 1500, 'o.jpg', 'o-t.jpg', 2000);
    insert.run('pushed', 2000, 1500, 'p.jpg', 'p-t.jpg', 2000);
    insert.run('live', 1000, null, 'l.jpg', 'l-t.jpg', null);
    insert.run('trashed', 1500, 1500, 't.jpg', 't-t.jpg', null);
    const payload = {
      ...makeAssetRecord({ id: 'offline', filename: 'o.jpg', thumbnailFilename: 'o-t.jpg' }),
      createdAt: 1000,
      updatedAt: 2000,
      deletedAt: 1500,
      purgedAt: 2000,
      mediaLibraryAssetId: 'm',
    };
    sqlite
      .prepare(
        `INSERT INTO outbox (collection, record_id, op, payload, updated_at) VALUES ('assets', 'offline', 'delete', ?, 2000)`,
      )
      .run(JSON.stringify(payload));
    const edit = { ...payload, id: 'live', filename: 'l.jpg', thumbnailFilename: 'l-t.jpg', deletedAt: null };
    sqlite
      .prepare(
        `INSERT INTO outbox (collection, record_id, op, payload, updated_at) VALUES ('assets', 'live', 'upsert', ?, 1000)`,
      )
      .run(JSON.stringify({ ...edit, updatedAt: 1000, purgedAt: null, notes: 'installed' }));
    run(sqlite, at('0011_outbox_fields'), migrations.length);
    return { sqlite, db: createDb(executor(sqlite)) as SyncDb };
  }

  // The installed app removed a purge's files at once, but not those of a purge it learned in a full
  // resync, and recorded neither: the first sweep after the update goes over every purge once.
  it('records no removal, so the first sweep after the update removes each confirmed purge’s files once', async () => {
    const { sqlite, db: upgraded } = installedAppDb();
    const rows = sqlite.prepare('SELECT id, files_removed_for FROM assets ORDER BY id').all();
    expect(rows).toEqual([
      { id: 'live', files_removed_for: null },
      { id: 'offline', files_removed_for: null },
      { id: 'pushed', files_removed_for: null },
      { id: 'trashed', files_removed_for: null },
    ]);
    await markFirstSyncDone(upgraded); // the installed app had pulled everything
    const { removed, removeFiles } = recording();
    await sweepPurgedFiles(upgraded, removeFiles);
    await sweepPurgedFiles(upgraded, removeFiles);
    expect(removed).toEqual(['p.jpg', 'p-t.jpg']); // the offline purge waits for the server
  });

  it('pushes the installed app’s pending rows without fields, an edit on top of one too, and a new one with them', async () => {
    const { db: upgraded } = installedAppDb();
    await repo.toggleFavorite(upgraded, 'live'); // coalesces into the installed app's row
    await repo.updateAll(upgraded, ['trashed'], { deletedAt: null });
    const sent: PushMutation[] = [];
    await runSyncOnce(
      upgraded,
      fakeTransport({
        push: async (req) => {
          sent.push(...req.mutations);
          return fakeTransport().push(req);
        },
      }),
    );
    const byId = new Map(sent.map((mutation) => [mutation.record.id, mutation]));
    expect(byId.get('offline')).not.toHaveProperty('fields');
    expect(byId.get('live')).not.toHaveProperty('fields');
    expect(byId.get('live')!.record).toMatchObject({ isFavorite: true });
    expect(byId.get('trashed')!.fields).toMatchObject({ deletedAt: expect.any(Number) });
  });

  // An installed app's offline purge reaches the new server as that app pushed it: without fields
  // (outbox.whole_record, set by migration 0011), so the server spares it the restored-deletions check,
  // as that app removed its files at once (sync-design §7). Should it lose anyway (a newer restore),
  // the asset comes back live, and its copies made since are swept when it is purged again.
  it('an offline purge from before the upgrade that loses to a restore: purged again later, its copies are swept', async () => {
    const { db: upgraded } = installedAppDb();
    const restored = {
      ...makeAssetRecord({ id: 'offline', filename: 'o.jpg', thumbnailFilename: 'o-t.jpg' }),
      createdAt: 1000,
      updatedAt: 2500,
      mediaLibraryAssetId: 'm',
      deletedAt: null,
      purgedAt: null,
    };
    const sent: PushMutation[] = [];
    const lost = fakeTransport({
      push: async (req) => {
        sent.push(...req.mutations);
        return {
          results: req.mutations.map((m) =>
            m.record.id === 'offline'
              ? { id: 'offline', collection: m.collection, status: 'skipped-lww' as const, current: restored }
              : { id: String(m.record.id), collection: m.collection, status: 'applied' as const },
          ),
        };
      },
    });
    await runSyncOnce(upgraded, lost);
    const purge = sent.find((m) => m.record.id === 'offline');
    expect(purge).toBeDefined();
    expect(purge).not.toHaveProperty('fields'); // pushed as the installed app pushed it
    const row = () => upgraded.select().from(schema.assets).where(eq(schema.assets.id, 'offline')).get();
    expect(await row()).toMatchObject({ deletedAt: null, purgedAt: null, filesRemovedFor: null }); // back, live
    await repo.remove(upgraded, ['offline']);
    await repo.purgeAssets(upgraded, ['offline']);
    const { removed, removeFiles } = recording();
    await runSyncOnce(upgraded, fakeTransport(), { removeFiles });
    expect(removed).toEqual(['o.jpg', 'o-t.jpg', 'p.jpg', 'p-t.jpg']); // and the confirmed purge's, once
  });
});
