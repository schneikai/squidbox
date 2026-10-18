import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import { libraryPaths } from '../src/library/libraryPaths';
import { addsRecords, applyMerge, moveMergedFiles, planMerge } from '../src/library/mergeLibrary';
import * as repo from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';
import { upsertRows } from '../src/sync/upsertRows';
import getAssetFileUri from '../src/utils/assets/files/getAssetFileUri';
import getAssetThumbnailUri from '../src/utils/assets/thumbnails/getAssetThumbnailUri';

// The device's files, by uri, and every move made (one that `loses` its file reports no error).
const files = new Set<string>();
const moves: string[] = [];
const lose = new Set<string>();
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('../src/library/fs', () => ({
  listFiles: async (dir: string) =>
    new Set([...files].filter((uri) => uri.startsWith(dir)).map((uri) => uri.slice(dir.length))),
  fileExists: async (uri: string) => files.has(uri),
  moveFile: async (from: string, to: string) => {
    if (!files.has(from) || files.has(to)) throw new Error(`bad move ${from} -> ${to}`);
    files.delete(from);
    if (!lose.has(from)) files.add(to);
    moves.push(`${from} -> ${to}`);
  },
}));

vi.mock('../src/sync/db/client', () => ({
  getDb: () => null,
  openAppDb: async () => null,
  deleteAppDb: async () => {},
  setOpenDb: () => {},
}));

const albums = makeRepository('albums', schema.albums);
const SRC = libraryPaths('src');
const TGT = libraryPaths('tgt');
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
let edgeIds = 0;
const newEdgeId = () => `edge-${++edgeIds}`;

let source: SyncDb;
let target: SyncDb;
beforeEach(() => {
  source = makeTestDb();
  target = makeTestDb();
  files.clear();
  moves.length = 0;
  lose.clear();
});

// A photo on the device: its file and thumbnail in the source's folders, never uploaded.
async function devicePhoto(over: Record<string, unknown> = {}) {
  const asset = await repo.createAsset(
    source,
    makeAssetRecord({ isFileSynced: false, isThumbnailSynced: false, isSynced: false, ...over }),
  );
  files.add(getAssetFileUri(asset.filename, SRC));
  files.add(getAssetThumbnailUri(asset.thumbnailFilename, SRC));
  return asset;
}
const outbox = (db: SyncDb) => db.select().from(schema.outbox);

describe('planMerge + applyMerge', () => {
  it('counts and copies photos, albums, posts and edges, each with an outbox row', async () => {
    const a = await devicePhoto({ filename: 'a.jpg', thumbnailFilename: 'at.jpg', mediaLibraryAssetId: 'm-a' });
    const b = await devicePhoto({ filename: 'b.jpg', thumbnailFilename: 'bt.jpg', mediaLibraryAssetId: 'm-b' });
    const gone = await devicePhoto({ mediaLibraryAssetId: 'm-gone' });
    await repo.deleteAssets(source, [gone.id]);
    await repo.createAsset(
      source,
      makeAssetRecord({ mediaLibraryAssetId: 'm-cloud', filename: 'cloud.jpg', isFileSynced: true }),
    ); // file elsewhere
    const album = await albums.create(source, makeAlbumRecord({ name: 'Trip' }));
    await albums.create(source, makeAlbumRecord({ name: 'Favorites', smartAlbumType: 'FAVORITES' }));
    await albumEdges.add(source, album.id, [a.id, b.id, gone.id], newEdgeId);
    await createPost(source, { text: 'hello' }, [a.id]);

    const plan = await planMerge(source, target, SRC);
    expect([plan.assets.length, plan.albums.length, plan.posts.length]).toEqual([2, 1, 1]);
    expect(plan.keepsSource).toBe(true);
    expect(plan.albumAssets.map((edge) => edge.assetId).sort()).toEqual([a.id, b.id].sort()); // not the deleted one
    expect(addsRecords(plan)).toBe(true);

    await applyMerge(target, plan);
    expect((await target.select().from(schema.assets)).map((row) => row.id).sort()).toEqual([a.id, b.id].sort());
    expect((await target.select().from(schema.albums)).map((row) => row.name)).toEqual(['Trip']);
    expect((await target.select().from(schema.posts)).map((row) => row.text)).toEqual(['hello']);
    expect(await target.select().from(schema.postAssets)).toHaveLength(1);
    expect(await outbox(target)).toHaveLength(2 + 1 + 1 + 2 + 1);
    expect((await target.select().from(schema.assets)).every((row) => row.syncError === null)).toBe(true);

    // Nothing left to add but the photo that lives elsewhere; the copied ones' files are still here.
    const again = await planMerge(source, target, SRC);
    expect(addsRecords(again)).toBe(false);
    expect(again.keepsSource).toBe(true);
    expect(again.files.sort()).toEqual(['a.jpg', 'b.jpg']);
    expect(again.thumbnails.sort()).toEqual(['at.jpg', 'bt.jpg']);
  });

  it('a record the target has by id is skipped; its pending edit is replayed with its own updatedAt when newer', async () => {
    const shared = makeAssetRecord({ mediaLibraryAssetId: 'm-s', updatedAt: 5000 });
    await upsertRows(target, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await upsertRows(source, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await repo.updateAsset(source, shared.id, { notes: 'edited on the device' }); // outbox row, updatedAt now

    const plan = await planMerge(source, target, SRC);
    expect(plan.assets).toEqual([]);
    expect(plan.files).toEqual([]);
    expect(plan.replays.map((row) => row.recordId)).toEqual([shared.id]);
    await applyMerge(target, plan);
    const [row] = await outbox(target);
    expect(row).toMatchObject({ collection: 'assets', recordId: shared.id, updatedAt: plan.replays[0]!.updatedAt });
    expect(row!.payload).toMatchObject({ notes: 'edited on the device' });
    // The target shows the edit at once, not after a push and pull.
    const [targetRow] = await target.select().from(schema.assets);
    expect(targetRow).toMatchObject({ notes: 'edited on the device', updatedAt: plan.replays[0]!.updatedAt });
    expect(addsRecords(await planMerge(source, target, SRC))).toBe(false);
  });

  it('a replay pushes the fields the device changed, keeping the account’s newer values of the others', async () => {
    const shared = makeAssetRecord({ mediaLibraryAssetId: 'm-s', updatedAt: 5000 });
    await upsertRows(source, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await upsertRows(target, 'assets', schema.assets, [{ ...shared, isFavorite: true, syncError: null }]);
    await repo.updateAsset(source, shared.id, { notes: 'edited on the device' });

    const plan = await planMerge(source, target, SRC);
    await applyMerge(target, plan);
    const [row] = await outbox(target);
    expect(row!.fields).toEqual(plan.replays[0]!.fields);
    expect(row!.fields).toEqual({ notes: plan.replays[0]!.updatedAt });
    const [targetRow] = await target.select().from(schema.assets);
    expect(targetRow).toMatchObject({ notes: 'edited on the device', isFavorite: true });
    expect(row!.payload).toMatchObject({ notes: 'edited on the device', isFavorite: true });
  });

  it('a replay keeps each field’s own clock, also for a target row edited later', async () => {
    const shared = makeAssetRecord({ mediaLibraryAssetId: 'm-s', updatedAt: 5000 });
    await upsertRows(source, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await repo.updateAsset(source, shared.id, { notes: 'first on the device' });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await repo.toggleFavorite(source, shared.id);
    const [sourceRow] = await outbox(source);
    // The account pulled a newer edit of another field: the device's edits are older than its row.
    const later = Date.now() + 60_000;
    await upsertRows(target, 'assets', schema.assets, [
      { ...shared, filename: 'b.jpg', updatedAt: later, syncError: null },
    ]);

    await applyMerge(target, await planMerge(source, target, SRC));
    const [row] = await outbox(target);
    expect(row!.fields).toEqual(sourceRow!.fields);
    expect(await target.select().from(schema.assets)).toMatchObject([
      { notes: 'first on the device', isFavorite: true, filename: 'b.jpg', updatedAt: later },
    ]);
  });

  it('a newer pending edit of the target keeps its field; the device’s other fields replay', async () => {
    const shared = makeAssetRecord({ mediaLibraryAssetId: 'm-s', updatedAt: 5000 });
    await upsertRows(target, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await upsertRows(source, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await repo.updateAsset(source, shared.id, { notes: 'older', isFavorite: true });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repo.updateAsset(target, shared.id, { notes: 'newer' });

    const plan = await planMerge(source, target, SRC);
    expect(Object.keys(plan.replays[0]!.fields)).toEqual(['isFavorite']);
    await applyMerge(target, plan);
    expect(await target.select().from(schema.assets)).toMatchObject([{ notes: 'newer', isFavorite: true }]);
    expect(Object.keys((await outbox(target))[0]!.fields).sort()).toEqual(['isFavorite', 'notes']);
  });

  it('does not replay over a newer pending edit of the target', async () => {
    const shared = makeAssetRecord({ mediaLibraryAssetId: 'm-s', updatedAt: 5000 });
    await upsertRows(target, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await upsertRows(source, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await repo.updateAsset(source, shared.id, { notes: 'older' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repo.updateAsset(target, shared.id, { notes: 'newer' });

    const plan = await planMerge(source, target, SRC);
    expect(plan.replays).toEqual([]);
    expect(addsRecords(plan)).toBe(false);
  });

  it('matches a photo the account has from the same camera-roll item: edges re-pointed, favorite OR, notes kept, no file', async () => {
    const theirs = await repo.createAsset(target, makeAssetRecord({ mediaLibraryAssetId: 'm-1', notes: 'theirs' }));
    const mine = await devicePhoto({
      mediaLibraryAssetId: 'm-1',
      isFavorite: true,
      notes: 'mine',
      filename: 'mine.jpg',
    });
    const album = await albums.create(source, makeAlbumRecord({ name: 'Trip' }));
    await albumEdges.add(source, album.id, [mine.id], newEdgeId);

    const plan = await planMerge(source, target, SRC);
    expect([plan.assets.length, plan.albums.length]).toEqual([0, 1]);
    expect(plan.duplicates).toEqual([{ id: theirs.id, isFavorite: true, notes: 'theirs\nmine' }]);
    expect(plan.albumAssets.map((edge) => edge.assetId)).toEqual([theirs.id]);
    expect([plan.files, plan.thumbnails]).toEqual([[], []]);

    await applyMerge(target, plan);
    const [row] = await target.select().from(schema.assets);
    expect(row).toMatchObject({ id: theirs.id, isFavorite: true, notes: 'theirs\nmine' });
    await moveMergedFiles(plan, SRC, TGT);
    expect(moves).toEqual([]);
    expect(files.has(getAssetFileUri('mine.jpg', SRC))).toBe(true);
    expect(addsRecords(await planMerge(source, target, SRC))).toBe(false);
  });

  it('keeps same-name albums separate', async () => {
    await albums.create(target, makeAlbumRecord({ name: 'Trip' }));
    await albums.create(source, makeAlbumRecord({ name: 'Trip' }));
    const plan = await planMerge(source, target, SRC);
    await applyMerge(target, plan);
    expect((await target.select().from(schema.albums)).map((row) => row.name)).toEqual(['Trip', 'Trip']);
  });

  it('copies in one transaction: a failure leaves the target untouched', async () => {
    const a = await devicePhoto();
    await albums.create(source, makeAlbumRecord({ name: 'Trip' }));
    const plan = await planMerge(source, target, SRC);
    // The target gets a record with that id meanwhile: the copy's insert conflicts.
    await upsertRows(target, 'assets', schema.assets, [{ ...a, syncError: null }]);

    await expect(applyMerge(target, plan)).rejects.toThrow();
    expect(await target.select().from(schema.albums)).toHaveLength(0);
    expect(await outbox(target)).toHaveLength(0);
  });

  it('moves files only into missing destinations; a second pass does nothing', async () => {
    await devicePhoto({ filename: 'a.jpg', thumbnailFilename: 'at.jpg', mediaLibraryAssetId: 'm-a' });
    await devicePhoto({ filename: 'b.jpg', thumbnailFilename: 'bt.jpg', mediaLibraryAssetId: 'm-b' });
    files.add(getAssetFileUri('b.jpg', TGT)); // the target already has b's file
    const plan = await planMerge(source, target, SRC);
    await applyMerge(target, plan);

    const resumed = await planMerge(source, target, SRC); // the plan of a boot after a crash
    expect([resumed.files.sort(), resumed.thumbnails.sort()]).toEqual([plan.files.sort(), plan.thumbnails.sort()]);
    await moveMergedFiles(resumed, SRC, TGT);
    expect(moves.sort()).toEqual(
      [
        `${getAssetFileUri('a.jpg', SRC)} -> ${getAssetFileUri('a.jpg', TGT)}`,
        `${getAssetThumbnailUri('at.jpg', SRC)} -> ${getAssetThumbnailUri('at.jpg', TGT)}`,
        `${getAssetThumbnailUri('bt.jpg', SRC)} -> ${getAssetThumbnailUri('bt.jpg', TGT)}`,
      ].sort(),
    );
    expect(files.has(getAssetFileUri('b.jpg', SRC))).toBe(true); // the target's copy stays, the source's isn't touched
    const before = [...files].sort();
    await moveMergedFiles(resumed, SRC, TGT);
    expect([...files].sort()).toEqual(before);
    expect((await planMerge(source, target, SRC)).files).toEqual(['b.jpg']);
  });

  it('a move whose destination is then missing is an error, so the source is never removed on it', async () => {
    await devicePhoto({ filename: 'a.jpg', thumbnailFilename: 'at.jpg', mediaLibraryAssetId: 'm-a' });
    const plan = await planMerge(source, target, SRC);
    await applyMerge(target, plan);
    lose.add(getAssetFileUri('a.jpg', SRC));
    await expect(moveMergedFiles(plan, SRC, TGT)).rejects.toThrow('Could not move');
  });

  it("merges several source photos of one camera-roll item into the account's photo, once", async () => {
    const theirs = await repo.createAsset(target, makeAssetRecord({ mediaLibraryAssetId: 'm-1', notes: null }));
    await devicePhoto({ mediaLibraryAssetId: 'm-1', isFavorite: true, notes: 'first', filename: 'one.jpg' });
    await devicePhoto({ mediaLibraryAssetId: 'm-1', isFavorite: false, notes: 'second', filename: 'two.jpg' });

    const plan = await planMerge(source, target, SRC);
    expect(plan.duplicates).toEqual([{ id: theirs.id, isFavorite: true, notes: 'first\nsecond' }]);
    await applyMerge(target, plan);
    const [row] = await target.select().from(schema.assets);
    expect(row).toMatchObject({ isFavorite: true, notes: 'first\nsecond' });
    expect(addsRecords(await planMerge(source, target, SRC))).toBe(false);
  });

  it('a copied photo whose file is on the device is backed up to the account again', async () => {
    const stale = await devicePhoto({
      mediaLibraryAssetId: 'm-s',
      filename: 's.jpg',
      isFileSynced: true,
      isThumbnailSynced: true,
      isSynced: true,
    });
    const plan = await planMerge(source, target, SRC);
    expect(plan.keepsSource).toBe(false);
    await applyMerge(target, plan);
    const [row] = await target.select().from(schema.assets);
    expect(row).toMatchObject({ id: stale.id, isFileSynced: false, isThumbnailSynced: false, isSynced: false });
  });

  it("replays an unpushed edit of an edge the target has, like a record's", async () => {
    const a = await devicePhoto({ mediaLibraryAssetId: 'm-a' });
    const album = await albums.create(source, makeAlbumRecord({ name: 'Trip' }));
    await albumEdges.add(source, album.id, [a.id], newEdgeId);
    await applyMerge(target, await planMerge(source, target, SRC)); // the edge is in the target now
    await new Promise((resolve) => setTimeout(resolve, 5));
    await albumEdges.remove(source, album.id, [a.id]); // removed on the device afterwards, not pushed

    const plan = await planMerge(source, target, SRC);
    expect(plan.replays.map((row) => row.collection)).toEqual(['album_assets']);
    await applyMerge(target, plan);
    const [row] = await outbox(target).then((rows) => rows.filter((r) => r.collection === 'album_assets'));
    expect(row!.payload).toMatchObject({ deletedAt: expect.any(Number) });
    const [edge] = await target.select().from(schema.albumAssets);
    expect(edge!.deletedAt).toEqual(expect.any(Number));
    expect(addsRecords(await planMerge(source, target, SRC))).toBe(false);
  });
});

// Adversarial replays: the device's pending edit lands on an account row with its own pending edit.
// Every field the target's outbox row names must carry the value of the side whose clock it holds,
// or the server merges one side's value under the other side's clock.
describe('replays against a pending edit of the target (adversarial)', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 3));
  const noFiles = async () => {};

  // One asset in both libraries, deleted in both (synced: no outbox rows).
  async function sharedDeletedAsset() {
    const shared = makeAssetRecord({ mediaLibraryAssetId: 'm-s', updatedAt: 5000, deletedAt: 5000 });
    await upsertRows(target, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await upsertRows(source, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    return shared;
  }

  // BUG: replayed() (mergeLibrary.ts) takes deletedAt AND purgedAt from the source payload whenever
  // either is replayed (withDeletionPair), but the outbox `fields` keep the target's own, newer clock
  // for the one that wasn't replayed. Here the source's purge replays and drags its old deletedAt
  // onto the target's newer restore: the outbox then pushes deletedAt=5000 under the restore's clock,
  // so the restore is lost and the stale purge applies on the server.
  it.fails('a device purge does not undo the account’s newer pending restore', async () => {
    const shared = await sharedDeletedAsset();
    await repo.purgeAssets(source, [shared.id], noFiles); // the device purges it, not pushed
    await tick();
    await repo.updateAllAssets(target, [shared.id], { deletedAt: null }); // the account restores it later

    await applyMerge(target, await planMerge(source, target, SRC));
    const [row] = await target.select().from(schema.assets);
    const [pending] = await outbox(target);
    // The newer restore stands, and the outbox pushes it with its clock.
    expect(row).toMatchObject({ deletedAt: null, purgedAt: null });
    expect(pending!.payload).toMatchObject({ deletedAt: null });
  });

  // BUG (same root cause): the source's delete replays and drags its purgedAt (null) over the
  // target's pending purge; the outbox keeps the purge's clock but pushes purgedAt=null, so the purge
  // (whose files this device already removed) never reaches the server and the asset is un-purged here.
  it.fails('a device delete does not undo the account’s pending purge', async () => {
    const shared = makeAssetRecord({ mediaLibraryAssetId: 'm-s', updatedAt: 5000 });
    await upsertRows(source, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await upsertRows(target, 'assets', schema.assets, [{ ...shared, deletedAt: 5000, syncError: null }]);
    await repo.purgeAssets(target, [shared.id], noFiles); // the account purges it, not pushed
    await tick();
    await repo.deleteAssets(source, [shared.id]); // the device deletes it later

    await applyMerge(target, await planMerge(source, target, SRC));
    const [row] = await target.select().from(schema.assets);
    const [pending] = await outbox(target);
    expect(row!.purgedAt).toEqual(expect.any(Number));
    expect(pending!.payload).toMatchObject({ purgedAt: expect.any(Number) });
    expect(pending!.payload.deletedAt).not.toBeNull();
  });

  it('a device edit of another field replays beside the account’s pending purge, which stays', async () => {
    const shared = await sharedDeletedAsset();
    await repo.updateAsset(source, shared.id, { notes: 'device notes' });
    await tick();
    await repo.purgeAssets(target, [shared.id], noFiles);

    await applyMerge(target, await planMerge(source, target, SRC));
    const [row] = await target.select().from(schema.assets);
    const [pending] = await outbox(target);
    expect(row).toMatchObject({ notes: 'device notes', deletedAt: 5000, purgedAt: expect.any(Number) });
    expect(Object.keys(pending!.fields).sort()).toEqual(['notes', 'purgedAt']);
    expect(pending!.payload).toMatchObject({ notes: 'device notes', deletedAt: 5000, purgedAt: row!.purgedAt });
  });

  it('every field the target outbox names carries the value of the side whose clock it holds', async () => {
    const shared = makeAssetRecord({ mediaLibraryAssetId: 'm-s', updatedAt: 5000, isFileSynced: false });
    await upsertRows(target, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await upsertRows(source, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await repo.updateAsset(source, shared.id, { notes: 'device, older' });
    await tick();
    await repo.updateAsset(target, shared.id, { notes: 'account, newer', isFavorite: true });
    await tick();
    await repo.updateAsset(source, shared.id, { isFileSynced: true, isThumbnailSynced: true, isSynced: true });
    await repo.updateAsset(source, shared.id, { oldFileId: 'x' }); // the newest edit

    await applyMerge(target, await planMerge(source, target, SRC));
    const [row] = await target.select().from(schema.assets);
    const [pending] = await outbox(target);
    const [sourcePending] = await outbox(source);
    expect(row).toMatchObject({
      notes: 'account, newer',
      isFavorite: true,
      oldFileId: 'x',
      isFileSynced: true,
      isThumbnailSynced: true,
      isSynced: true,
    });
    for (const field of Object.keys(pending!.fields))
      expect(pending!.payload[field]).toEqual(row![field as keyof typeof row]);
    expect(pending!.fields.notes).toBeLessThan(sourcePending!.fields.oldFileId!);
    expect(pending!.fields.oldFileId).toBe(sourcePending!.fields.oldFileId);
    expect(pending!.fields.isFileSynced).toBe(sourcePending!.fields.isFileSynced);
    expect(pending!.fields.isSynced).toBe(sourcePending!.fields.isFileSynced);
  });
});
