import { eq, lte } from 'drizzle-orm';

import { makeAlbumRecord, makeAssetRecord } from './factory';
import { faults, files, resetDevice, stores } from './fakeDevice';
import { makeTestDb } from './testDb';
import { closeLibrary, openLibrary, openLibraryId } from '../../src/library/current';
import { libraryPaths } from '../../src/library/libraryPaths';
import { getRegistry, loadRegistry, type Registry } from '../../src/library/registry';
import * as repo from '../../src/sync/assetsRepository';
import { getDb } from '../../src/sync/db/client';
import type { AppDb } from '../../src/sync/db/driver';
import * as schema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';
import { makeEdgeRepository } from '../../src/sync/edgesRepository';
import { makeRepository } from '../../src/sync/repository';
import { markFirstSyncDone } from '../../src/sync/status';
import { upsertRows } from '../../src/sync/upsertRows';
import { getAssetFileUri } from '../../src/utils/assets/assetStorage';

/*
 * The merge tests' device (on helpers/fakeDevice, whose mocks the test file sets up): the device
 * library DEV, merged into the account's library ACC.
 */
export const DEV = { id: 'dev', owner: { kind: 'device' as const } };
export const ACC = { id: 'acc', owner: { kind: 'account' as const, serverId: 's1', userId: 'u1', email: 'u1@test' } };
export const SRC = libraryPaths('dev');
export const TGT = libraryPaths('acc');
export const sourceDb = () => stores.get(SRC.dbName)!;
export const entry = (id: string) => getRegistry().libraries.find((library) => library.id === id);

/** A photo in the device library, with its thumbnail on the device, and its file unless it is in the cloud. */
export async function devicePhoto(over: Record<string, unknown> = {}) {
  const asset = await repo.create(
    sourceDb(),
    makeAssetRecord({ isFileSynced: false, isThumbnailSynced: false, isSynced: false, ...over }),
  );
  if (!asset.isFileSynced) files.add(getAssetFileUri(asset.filename, SRC));
  files.add(`file:///docs/${SRC.thumbnailsDir}${asset.thumbnailFilename}`);
  return asset;
}

/**
 * A fresh device: these libraries listed, the device library's database empty, no files, the account's
 * library pushing after each commit only with `autoPush`. Returns the device library's database.
 */
export async function resetLibraries(
  libraries: Registry['libraries'] = [DEV, ACC],
  { autoPush = false } = {},
): Promise<AppDb> {
  if (openLibraryId()) await closeLibrary();
  resetDevice();
  faults.autoPush = autoPush;
  await loadRegistry(async () => ({ libraries }));
  const source = makeTestDb();
  stores.set(SRC.dbName, source);
  return source;
}

/** ... with the account's library open, its first full pull done. */
export async function resetToAccount(libraries: Registry['libraries'] = [DEV, ACC]): Promise<AppDb> {
  const source = await resetLibraries(libraries);
  await openLibrary(ACC);
  await markFirstSyncDone(getDb());
  return source;
}

/** A push cut short: the older half of the outbox reached the server. */
export async function pushOlderHalf(db: SyncDb) {
  const ids = (await db.select().from(schema.outbox)).map((row) => row.id).sort((a, b) => a - b);
  const cut = ids[Math.floor(ids.length / 2)];
  if (cut !== undefined) await db.delete(schema.outbox).where(lte(schema.outbox.id, cut));
}

/** Another device deletes the photo `id`, pulled into `db` at `at`, unless it is deleted already. */
export async function deletedElsewhere(db: SyncDb, id: string, at: number) {
  const [row] = await db.select().from(schema.assets).where(eq(schema.assets.id, id));
  if (row && row.deletedAt === null)
    await upsertRows(db, 'assets', schema.assets, [{ ...row, deletedAt: at, updatedAt: at }]);
}

/** The device library's album "Trip", holding the first three of `photos`; returns their ids. */
export async function addToTrip(photos: { id: string }[]) {
  const album = makeAlbumRecord({ name: 'Trip' });
  await makeRepository('albums', schema.albums).create(sourceDb(), album);
  const inAlbum = photos.slice(0, 3).map((photo) => photo.id);
  await makeEdgeRepository('album_assets', schema.albumAssets, 'albumId').add(sourceDb(), album.id, inAlbum, () =>
    crypto.randomUUID(),
  );
  return inAlbum;
}
