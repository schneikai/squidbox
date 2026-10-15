import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createPost, makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import { libraryPaths } from '../src/library/libraryPaths';
import { applyMerge, moveMergedFiles, planMerge } from '../src/library/mergeLibrary';
import * as repo from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';
import { upsertRows } from '../src/sync/upsertRows';
import getAssetFileUri from '../src/utils/assets/files/getAssetFileUri';
import getAssetThumbnailUri from '../src/utils/assets/thumbnails/getAssetThumbnailUri';

// The device's files, by uri, and every move made.
const files = new Set<string>();
const moves: string[] = [];
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('../src/library/fs', () => ({
  fileExists: async (uri: string) => files.has(uri),
  moveFile: async (from: string, to: string) => {
    if (!files.has(from) || files.has(to)) throw new Error(`bad move ${from} -> ${to}`);
    files.delete(from);
    files.add(to);
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
    expect(plan.counts).toEqual({ photos: 2, albums: 1, posts: 1, alreadyInAccount: 0, cloudOnly: 1 });
    expect(plan.albumAssets.map((edge) => edge.assetId).sort()).toEqual([a.id, b.id].sort()); // not the deleted one
    expect(plan.nothingLeftToAdd).toBe(false);

    await applyMerge(target, plan);
    expect((await target.select().from(schema.assets)).map((row) => row.id).sort()).toEqual([a.id, b.id].sort());
    expect((await target.select().from(schema.albums)).map((row) => row.name)).toEqual(['Trip']);
    expect((await target.select().from(schema.posts)).map((row) => row.text)).toEqual(['hello']);
    expect(await target.select().from(schema.postAssets)).toHaveLength(1);
    expect(await outbox(target)).toHaveLength(2 + 1 + 1 + 2 + 1);
    expect((await target.select().from(schema.assets)).every((row) => row.syncError === null)).toBe(true);

    // Nothing left to add but the photo that lives elsewhere; the copied ones' files are still here.
    const again = await planMerge(source, target, SRC);
    expect(again.nothingLeftToAdd).toBe(true);
    expect(again.counts).toMatchObject({ photos: 0, albums: 0, posts: 0, alreadyInAccount: 2, cloudOnly: 1 });
    expect(again.sameIdAssets.map((asset) => asset.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('a record the target has by id is skipped; its pending edit is replayed with its own updatedAt when newer', async () => {
    const shared = makeAssetRecord({ mediaLibraryAssetId: 'm-s', updatedAt: 5000 });
    await upsertRows(target, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await upsertRows(source, 'assets', schema.assets, [{ ...shared, syncError: null }]);
    await repo.updateAsset(source, shared.id, { notes: 'edited on the device' }); // outbox row, updatedAt now

    const plan = await planMerge(source, target, SRC);
    expect(plan.assets).toEqual([]);
    expect(plan.counts.alreadyInAccount).toBe(1);
    expect(plan.replays.map((row) => row.recordId)).toEqual([shared.id]);
    await applyMerge(target, plan);
    const [row] = await outbox(target);
    expect(row).toMatchObject({ collection: 'assets', recordId: shared.id, updatedAt: plan.replays[0]!.updatedAt });
    expect(row!.payload).toMatchObject({ notes: 'edited on the device' });
    expect((await planMerge(source, target, SRC)).nothingLeftToAdd).toBe(true);
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
    expect(plan.nothingLeftToAdd).toBe(true);
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
    expect(plan.counts).toMatchObject({ photos: 0, albums: 1, alreadyInAccount: 1 });
    expect(plan.duplicates).toEqual([{ id: theirs.id, isFavorite: true, notes: 'theirs\nmine' }]);
    expect(plan.albumAssets.map((edge) => edge.assetId)).toEqual([theirs.id]);
    expect(plan.sameIdAssets).toEqual([]);

    await applyMerge(target, plan);
    const [row] = await target.select().from(schema.assets);
    expect(row).toMatchObject({ id: theirs.id, isFavorite: true, notes: 'theirs\nmine' });
    expect(await moveMergedFiles(plan.sameIdAssets, SRC, TGT)).toBe(0);
    expect(files.has(getAssetFileUri('mine.jpg', SRC))).toBe(true);
    expect((await planMerge(source, target, SRC)).nothingLeftToAdd).toBe(true);
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

  it('moves files only into missing destinations and only for same-id assets; a second pass does nothing', async () => {
    const a = await devicePhoto({ filename: 'a.jpg', thumbnailFilename: 'at.jpg', mediaLibraryAssetId: 'm-a' });
    const b = await devicePhoto({ filename: 'b.jpg', thumbnailFilename: 'bt.jpg', mediaLibraryAssetId: 'm-b' });
    files.add(getAssetFileUri('b.jpg', TGT)); // the target already has b's file
    const plan = await planMerge(source, target, SRC);
    await applyMerge(target, plan);

    const candidates = (await planMerge(source, target, SRC)).sameIdAssets;
    expect(await moveMergedFiles(candidates, SRC, TGT)).toBe(3);
    expect(moves).toEqual([
      `${getAssetFileUri('a.jpg', SRC)} -> ${getAssetFileUri('a.jpg', TGT)}`,
      `${getAssetThumbnailUri('at.jpg', SRC)} -> ${getAssetThumbnailUri('at.jpg', TGT)}`,
      `${getAssetThumbnailUri('bt.jpg', SRC)} -> ${getAssetThumbnailUri('bt.jpg', TGT)}`,
    ]);
    expect(files.has(getAssetFileUri('b.jpg', SRC))).toBe(true); // the target's copy stays, the source's isn't touched
    const before = [...files].sort();
    expect(await moveMergedFiles(candidates, SRC, TGT)).toBe(0);
    expect([...files].sort()).toEqual(before);
    expect([a.id, b.id]).toHaveLength(2);
  });
});
