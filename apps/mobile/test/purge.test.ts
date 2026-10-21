import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { fakeTransport } from './helpers/fakeTransport';
import { makeTestDb } from './helpers/testDb';
import assetQuery from '../src/features/asset-list/assetQuery';
import postQuery from '../src/features/post-list/postQuery';
import * as repo from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';
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
    const asset = await repo.createAsset(db, makeAssetRecord());
    const album = makeAlbumRecord();
    await albums.create(db, album);
    await albumEdges.add(db, album.id, [asset.id], () => 'edge-1');
    await repo.deleteAssets(db, [asset.id]);
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
    const [mine, other, alsoPurged, before] = await repo.createAssets(db, [
      makeAssetRecord({ filename: 'shared.jpg', thumbnailFilename: 'mine-t.jpg' }),
      makeAssetRecord({ filename: 'other.jpg', thumbnailFilename: 'shared.jpg' }), // a live asset naming it
      makeAssetRecord({ filename: 'both.jpg', thumbnailFilename: 'both-t.jpg' }),
      makeAssetRecord({ filename: 'both.jpg', thumbnailFilename: 'gone-t.jpg' }),
    ]);
    await repo.purgeAssets(db, [before!.id]); // a purged asset uses no name any more
    await runSyncOnce(db, fakeTransport());
    await repo.purgeAssets(db, [mine!.id, alsoPurged!.id]);

    const failure = new Error('disk full');
    await expect(runSyncOnce(db, fakeTransport(), { removeFiles: async () => Promise.reject(failure) })).rejects.toBe(
      failure,
    );
    expect((await assetRow(mine!.id))?.filesRemovedAt).toBeNull(); // still to remove: the next sweep does
    const { removed, removeFiles } = recording();
    await runSyncOnce(db, fakeTransport(), { removeFiles });
    expect((await assetRow(mine!.id))?.filesRemovedAt).toEqual(expect.any(Number));
    expect(removed.sort()).toEqual(['both-t.jpg', 'both.jpg', 'mine-t.jpg']);
    expect((await assetRow(other!.id))?.purgedAt).toBeNull();
  });

  it('a purge that loses to a restore elsewhere keeps the files, and the asset comes back', async () => {
    const asset = await repo.createAsset(db, makeAssetRecord({ deletedAt: 1000 }));
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
    const [kept, gone] = await repo.createAssets(db, [makeAssetRecord(), makeAssetRecord()]);
    await createPost(db, { id: 'p1' }, [kept!.id, gone!.id]);
    await repo.deleteAssets(db, [gone!.id]);
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
    const trashed = await repo.createAsset(
      db,
      makeAssetRecord({ filename: 'trashed.jpg', thumbnailFilename: 'tt.jpg' }),
    );
    const purged = await repo.createAsset(db, makeAssetRecord({ filename: 'purged.jpg', thumbnailFilename: 'tt.jpg' }));
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
    const asset = await repo.createAsset(db, makeAssetRecord());
    await repo.purgeAssets(db, [asset.id]);
    await runSyncOnce(db, fakeTransport());
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
    const asset = await repo.createAsset(db, makeAssetRecord({ filename: 'r.jpg', thumbnailFilename: 'r-t.jpg' }));
    await runSyncOnce(db, fakeTransport());
    const { removed, removeFiles } = recording();

    await fullResync(db, pulling([{ ...asset, deletedAt: 2000, purgedAt: 3000, updatedAt: 3000 }]), { removeFiles });

    expect((await assetRow(asset.id))?.purgedAt).toBe(3000);
    expect(removed).toEqual(['r.jpg', 'r-t.jpg']);
  });

  it('a purge pulled while this device’s own purge of it waits for its push: no removal then, once at the push', async () => {
    const asset = await repo.createAsset(db, makeAssetRecord({ filename: 'w.jpg', thumbnailFilename: 'w-t.jpg' }));
    await repo.deleteAssets(db, [asset.id]);
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
    const asset = await repo.createAsset(
      db,
      makeAssetRecord({ filename: 'mine.jpg', thumbnailFilename: 'mine-t.jpg' }),
    );
    await runSyncOnce(db, fakeTransport());
    await repo.updateAsset(db, asset.id, { notes: 'edited offline' });
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
