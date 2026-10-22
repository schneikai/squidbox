import { and, eq, isNull } from 'drizzle-orm';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import { libraryPaths } from '../src/library/libraryPaths';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeRepository } from '../src/sync/repository';
import {
  clearFirstSyncDone,
  getKeptFor,
  getMergeMarks,
  getMergeTarget,
  markFirstSyncDone,
  setMergeMarks,
  setMergeTarget,
} from '../src/sync/status';
import getAssetFileUri from '../src/utils/assets/files/getAssetFileUri';

// The device: databases by name (a store survives close and reopen), files by uri, the list.
const stores = new Map<string, AppDb>();
const deleted: string[] = [];
const files = new Set<string>();
const storage = new Map<string, string>();

vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('../src/sync/db/client', () => {
  let open: AppDb | null = null;
  const openAppDb = async (name: string) => {
    if (!stores.has(name)) stores.set(name, makeTestDb());
    return Object.assign(Object.create(stores.get(name)!), { close: async () => {} });
  };
  return {
    openAppDb,
    withAppDb: async (name: string, use: (db: AppDb) => Promise<unknown>) => use(await openAppDb(name)),
    deleteAppDb: async (name: string) => {
      deleted.push(name);
      stores.delete(name);
    },
    getDb: () => open!,
    setOpenDb: (db: AppDb | null) => {
      open = db;
    },
  };
});
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
  },
}));
vi.mock('../src/library/fs', () => ({
  listFiles: async (dir: string) =>
    new Set([...files].filter((uri) => uri.startsWith(dir)).map((uri) => uri.slice(dir.length))),
  fileExists: async (uri: string) => files.has(uri),
  moveFile: async (from: string, to: string) => {
    files.delete(from);
    files.add(to);
  },
  removeLibraryFolders: async () => {},
  // A device library's sweep (current.ts sweepOpenLibrary).
  purgedFilesRemover:
    (paths: { filesDir: string; thumbnailsDir: string }) =>
    async (names: { filename?: string; thumbnailFilename?: string }[]) => {
      for (const { filename, thumbnailFilename } of names) {
        if (filename) files.delete(`file:///docs/${paths.filesDir}${filename}`);
        if (thumbnailFilename) files.delete(`file:///docs/${paths.thumbnailsDir}${thumbnailFilename}`);
      }
    },
}));
const applyMergeImpl = vi.hoisted(() => ({ fail: false }));
vi.mock('../src/library/mergeLibrary', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/library/mergeLibrary')>();
  return {
    ...original,
    planMerge: vi.fn(original.planMerge),
    applyMerge: vi.fn((...args: Parameters<typeof original.applyMerge>) => {
      if (applyMergeImpl.fail) throw new Error('apply failed');
      return original.applyMerge(...args);
    }),
  };
});

const { closeLibrary, openLibrary, openLibraryId, sweepOpenLibrary } = await import('../src/library/current');
const { getRegistry, loadRegistry, updateLibrary, updateRegistry } = await import('../src/library/registry');
const { mergeLibrary, resumeMerges } = await import('../src/library/mergeRun');
const { getDb } = await import('../src/sync/db/client');

const albums = makeRepository('albums', schema.albums);
const DEV = { id: 'dev', owner: { kind: 'device' as const } };
const ACC = { id: 'acc', owner: { kind: 'account' as const, serverId: 's1', userId: 'u1', email: 'u1@test' } };
const SRC = libraryPaths('dev');
const TGT = libraryPaths('acc');
const sourceDb = () => stores.get(SRC.dbName)!;
const entry = (id: string) => getRegistry().libraries.find((library) => library.id === id);
// A merge marker for a library of account u1 (mergeMarker.ts).
const marker = (library: string, userId = 'u1') => ({ library, serverId: 's1', userId });

async function devicePhoto(over: Record<string, unknown> = {}) {
  const asset = await repo.createAsset(
    sourceDb(),
    makeAssetRecord({ isFileSynced: false, isThumbnailSynced: false, isSynced: false, ...over }),
  );
  files.add(getAssetFileUri(asset.filename, SRC));
  files.add(`file:///docs/${SRC.thumbnailsDir}${asset.thumbnailFilename}`);
  return asset;
}

describe('mergeLibrary / resumeMerges', () => {
  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    deleted.length = 0;
    files.clear();
    storage.clear();
    applyMergeImpl.fail = false;
    await loadRegistry(async () => ({ libraries: [DEV, ACC] }));
    stores.set(SRC.dbName, makeTestDb()); // the parked device library
    await openLibrary(ACC);
    await markFirstSyncDone(getDb()); // the account library has synced before
  });

  it('adds the device library to the account and removes it once its files moved', async () => {
    const a = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await albums.create(sourceDb(), makeAlbumRecord({ name: 'Trip' }));

    await mergeLibrary('dev', 'acc');

    expect((await getDb().select().from(schema.assets)).map((row) => row.id)).toEqual([a.id]);
    expect(await getDb().select().from(schema.albums)).toHaveLength(1);
    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
    expect(files.has(getAssetFileUri('a.jpg', SRC))).toBe(false);
    expect(entry('dev')).toBeUndefined();
    expect(deleted).toEqual([SRC.dbName]);
  });

  it('a throw before the commit clears the marker and leaves both libraries as they were', async () => {
    await devicePhoto();
    applyMergeImpl.fail = true;

    await expect(mergeLibrary('dev', 'acc')).rejects.toThrow('apply failed');

    expect(entry('dev')).toEqual(DEV);
    expect(await getDb().select().from(schema.assets)).toHaveLength(0);
    expect(stores.has(SRC.dbName)).toBe(true);
    // The marker in the source's database goes with the list's: its purges are its own again.
    expect(await getMergeTarget(sourceDb())).toBeNull();
  });

  it('a crash between the marker and the commit, then boot: the merge runs again and finishes', async () => {
    const a = await devicePhoto({ filename: 'a.jpg' });
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') })); // the marker a crash left

    await resumeMerges();

    expect((await getDb().select().from(schema.assets)).map((row) => row.id)).toEqual([a.id]);
    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
    expect(entry('dev')).toBeUndefined();
    expect(deleted).toEqual([SRC.dbName]);
  });

  it('a crash after the commit, then boot: the files move, what was added meanwhile joins too, the source goes', async () => {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    const a = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') }));
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC, 'acc')); // committed, then the crash
    const later = await devicePhoto({ filename: 'later.jpg', mediaLibraryAssetId: 'm-later' });

    await resumeMerges();

    expect((await getDb().select().from(schema.assets)).map((row) => row.id).sort()).toEqual([a.id, later.id].sort());
    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
    expect(files.has(getAssetFileUri('later.jpg', TGT))).toBe(true);
    expect(entry('dev')).toBeUndefined();
    expect(deleted).toEqual([SRC.dbName]);
  });

  it("keeps a source that holds photos living in another account's storage, recorded as kept for the account", async () => {
    await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await repo.createAsset(
      sourceDb(),
      makeAssetRecord({ mediaLibraryAssetId: 'm-cloud', filename: 'cloud.jpg', isFileSynced: true }),
    );

    await mergeLibrary('dev', 'acc');

    expect(entry('dev')).toEqual({ ...DEV, keptFor: 'acc' });
    expect(stores.has(SRC.dbName)).toBe(true);
    expect(await getMergeTarget(sourceDb())).toBeNull(); // done: its purges are its own again
    expect(await getKeptFor(sourceDb())).toBe('acc'); // the list is rebuilt from it (rebuildRegistry)
    // Never merged again: neither library keeps its marks (the account's go before keptFor is set).
    expect(await getMergeMarks(sourceDb(), SRC.dbName)).toEqual({});
    expect(await getMergeMarks(getDb(), SRC.dbName)).toEqual({});
    expect(await getDb().select().from(schema.assets)).toHaveLength(1);
    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);

    const { planMerge } = await import('../src/library/mergeLibrary');
    const planned = vi.mocked(planMerge).mock.calls.length;
    await resumeMerges(); // every later boot: the merge is complete, nothing runs
    expect(entry('dev')).toEqual({ ...DEV, keptFor: 'acc' });
    expect(vi.mocked(planMerge).mock.calls).toHaveLength(planned);
  });

  it('skips a marked source that is the open library, and one failing merge does not stop the next', async () => {
    const OTHER = { id: 'other', owner: { kind: 'device' as const } };
    storage.clear();
    await loadRegistry(async () => ({
      libraries: [{ ...DEV, mergedInto: marker('acc') }, ACC, { ...OTHER, mergedInto: marker('acc') }],
    }));
    await closeLibrary();
    await openLibrary(DEV); // the session was lost: the marked device library opened again
    applyMergeImpl.fail = true;

    await resumeMerges();
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: marker('acc') }); // waits for a boot that opens another
    expect(entry('other')).toBeUndefined(); // holding nothing, its merge completed

    await closeLibrary();
    await openLibrary(ACC);
    await devicePhoto();
    await resumeMerges();
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: marker('acc') }); // failed: the next boot tries again
  });

  // The marker holds the account the source belongs to: a library of that account takes it over.
  it('the list’s marker of a merge whose target is gone stays, as the source’s own does', async () => {
    storage.clear();
    await loadRegistry(async () => ({ libraries: [{ ...DEV, mergedInto: marker('gone') }, ACC] }));
    await setMergeTarget(sourceDb(), marker('gone')); // a pass had copied records
    await resumeMerges();
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: marker('gone') });
    expect(await getMergeTarget(sourceDb())).toEqual(marker('gone')); // what it copied may be in the account: purges wait
  });
});

const { sweepPurgedFiles } = await import('../src/sync/sweepPurgedFiles');

describe('a failed pass after an earlier one committed', () => {
  // removeAssetFiles for the open library, on the fake file system.
  const removeFiles = async (names: { filename?: string; thumbnailFilename?: string }[]) => {
    for (const { filename, thumbnailFilename } of names) {
      if (filename) files.delete(getAssetFileUri(filename, SRC));
      if (thumbnailFilename) files.delete(`file:///docs/${SRC.thumbnailsDir}${thumbnailFilename}`);
    }
  };

  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    files.clear();
    storage.clear();
    applyMergeImpl.fail = false;
    await loadRegistry(async () => ({ libraries: [DEV, ACC] }));
    stores.set(SRC.dbName, makeTestDb());
    await openLibrary(ACC);
    await markFirstSyncDone(getDb()); // the account library has synced before
  });

  // Pass 1 copied the photo into the account and crashed before moving its files; the device library,
  // opened again while the session was lost, purged it and kept its files (the marker: that purge can
  // still lose in the account). The next pass fails before its commit: the markers stay as they were,
  // so the device library's next sweep still keeps the files.
  it('a failed pass keeps the marker of an earlier pass that committed: the device purge keeps its files', async () => {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    const a = await devicePhoto({ filename: 'a.jpg', thumbnailFilename: 'a-t.jpg', mediaLibraryAssetId: 'm-a' });
    // Pass 1: the markers, every record committed into the account, then the crash.
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') }));
    await setMergeTarget(sourceDb(), marker('acc'));
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC, 'acc'));

    // The session is lost: the device library opens again, and its photo is purged there.
    await closeLibrary();
    await openLibrary(DEV);
    await repo.deleteAssets(getDb(), [a.id]);
    await repo.purgeAssets(getDb(), [a.id]);
    await sweepPurgedFiles(getDb(), removeFiles);
    expect(files.has(getAssetFileUri('a.jpg', SRC))).toBe(true); // waits, as the marker says

    // Signed in again: the boot's next pass fails before its commit.
    await closeLibrary();
    await openLibrary(ACC);
    applyMergeImpl.fail = true;
    await resumeMerges();
    expect((await getDb().select().from(schema.assets)).map((row) => row.deletedAt)).toEqual([null]); // live there

    // The session is lost once more: the device library opens and sweeps.
    await closeLibrary();
    await openLibrary(DEV);
    await sweepPurgedFiles(getDb(), removeFiles);
    expect(files.has(getAssetFileUri('a.jpg', SRC))).toBe(true);
  });
});

describe('the sweep at a library’s open', () => {
  const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    files.clear();
    storage.clear();
    await loadRegistry(async () => ({ libraries: [DEV, ACC] }));
    stores.set(SRC.dbName, makeTestDb());
  });

  it('a device library sweeps when it opens and after a purge', async () => {
    const a = await devicePhoto({ filename: 'a.jpg' });
    const b = await devicePhoto({ filename: 'b.jpg' });
    await repo.deleteAssets(sourceDb(), [a.id, b.id]);
    await repo.purgeAssets(sourceDb(), [a.id]);
    await openLibrary(DEV);
    await settled();
    expect(files.has(getAssetFileUri('a.jpg', SRC))).toBe(false);
    await repo.purgeAssets(getDb(), [b.id]);
    sweepOpenLibrary(); // as AssetsProvider does after a purge
    await settled();
    expect(files.has(getAssetFileUri('b.jpg', SRC))).toBe(false);
  });

  it('an account library doesn’t: it sweeps at the end of its sync runs only, inside the sync queue', async () => {
    const TGT_DB = makeTestDb();
    stores.set(TGT.dbName, TGT_DB);
    const asset = await repo.createAsset(TGT_DB, makeAssetRecord({ filename: 'acc.jpg' }));
    files.add(getAssetFileUri('acc.jpg', TGT));
    await repo.deleteAssets(TGT_DB, [asset.id]);
    await repo.purgeAssets(TGT_DB, [asset.id]);
    await TGT_DB.delete(schema.outbox); // confirmed by the server
    await markFirstSyncDone(TGT_DB);
    await openLibrary(ACC);
    sweepOpenLibrary();
    await settled();
    expect(files.has(getAssetFileUri('acc.jpg', TGT))).toBe(true);
  });
});

const { makeEdgeRepository } = await import('../src/sync/edgesRepository');
const { upsertRows } = await import('../src/sync/upsertRows');

// A pass that committed, then a crash (or a failed file move) before the source went; the device
// library may be opened and edited again meanwhile (the session was lost), and the account's library
// syncs. The boot's resumed pass must add what the device did since, and only that: the target keeps
// per source record the newest clock a committed pass merged (getMergeMarks).
describe('a merge pass run again (a crash, a failed file move)', () => {
  const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
  let edgeIds = 0;
  const newEdgeId = () => `00000000-0000-4000-8000-${String(++edgeIds).padStart(12, '0')}`;

  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    files.clear();
    storage.clear();
    applyMergeImpl.fail = false;
    await loadRegistry(async () => ({ libraries: [DEV, ACC] }));
    stores.set(SRC.dbName, makeTestDb());
    await openLibrary(ACC);
    await markFirstSyncDone(getDb()); // the account library has synced before
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // The sign-in's pass: the markers, every record committed into the account, then the crash.
  async function firstPassThenCrash() {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') }));
    await setMergeTarget(sourceDb(), marker('acc'));
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC, 'acc'));
  }
  async function openDevice() {
    await closeLibrary();
    await openLibrary(DEV);
  }
  async function openAccount() {
    await closeLibrary();
    await openLibrary(ACC);
  }
  const accountAsset = async (id: string) =>
    (await getDb().select().from(schema.assets).where(eq(schema.assets.id, id)))[0]!;

  // Every merge waits for the target's first full pull: before it, no camera-roll item would match,
  // and the records an earlier pass copied into a library that left the list (in the account since)
  // aren't there to replay onto. A first pass that waits holds nothing: the source stays free. The
  // boot and the end of that pull try again (useMergeAfterFirstSync).
  it('a merge waits for the target’s first full pull, a first one and one after the target is gone', async () => {
    await clearFirstSyncDone(getDb());
    const photo = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await mergeLibrary('dev', 'acc'); // the sign-in
    expect(entry('dev')).toEqual(DEV);
    expect(await getMergeTarget(sourceDb())).toBeNull();
    expect(await getDb().select().from(schema.assets)).toEqual([]);

    await setMergeTarget(sourceDb(), marker('gone'));
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') }));
    await resumeMerges();
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: marker('acc') }); // waits, for the next boot
    expect(await getDb().select().from(schema.assets)).toEqual([]);
    await markFirstSyncDone(getDb());
    await resumeMerges();
    expect(entry('dev')).toBeUndefined();
    expect((await getDb().select().from(schema.assets)).map((row) => row.id)).toEqual([photo.id]);
  });

  // Clocks are per record (nextUpdatedAt), not across a library: a device clock that ran ahead when
  // one record was written (set by hand, then corrected) must not hide the later edits of the others.
  it('an edit made on the device after the pass, stamped below the pass’s mark (the clock went back), reaches the account', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T10:00:00Z'));
    const kept = await devicePhoto({ filename: 'k.jpg', mediaLibraryAssetId: 'm-k' });
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z')); // the clock a day ahead for a while
    await devicePhoto({ filename: 'f.jpg', mediaLibraryAssetId: 'm-f' });
    await firstPassThenCrash();

    vi.setSystemTime(new Date('2026-10-21T10:05:00Z')); // set right again
    await openDevice();
    await repo.updateAsset(getDb(), kept.id, { notes: 'The one for the cover' });

    await openAccount();
    await resumeMerges();
    expect(entry('dev')).toBeUndefined(); // complete: the device library is gone
    expect((await accountAsset(kept.id)).notes).toBe('The one for the cover');
  });

  // A device photo of a camera-roll item the account has is merged into the account's photo
  // (favorite OR'd, notes appended), not copied; its mark keeps a resumed pass from merging it again
  // from the device's values over the account's unfavorite made since.
  it('a resumed pass doesn’t merge a matched photo again over what the account changed since', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', filename: 'p.jpg', isFavorite: false });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]); // synced
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true });
    await firstPassThenCrash();
    expect((await accountAsset(accountPhoto.id)).isFavorite).toBe(true);

    // The account library pushes that, then pulls the unfavorite another device made later.
    await getDb().delete(schema.outbox);
    const later = (await accountAsset(accountPhoto.id)).updatedAt + 60_000;
    await upsertRows(getDb(), 'assets', schema.assets, [
      { ...(await accountAsset(accountPhoto.id)), isFavorite: false, updatedAt: later },
    ]);

    await resumeMerges();
    expect(entry('dev')).toBeUndefined();
    expect((await accountAsset(accountPhoto.id)).isFavorite).toBe(false);
  });

  // An album add creates a new edge, so taking a photo out of an album and putting it back makes a
  // new edge beside the tombstone. The resumed pass replays the old edge's removal, and the new edge
  // is copied: the membership the account has is counted after this plan's own replays.
  it('a photo taken out of an album on the device and put back after the pass stays in the album', async () => {
    const photo = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    const album = await albums.create(sourceDb(), makeAlbumRecord({ name: 'Trip' }));
    await albumEdges.add(sourceDb(), album.id, [photo.id], newEdgeId);
    await firstPassThenCrash();

    await openDevice();
    await albumEdges.remove(getDb(), album.id, [photo.id]);
    await albumEdges.add(getDb(), album.id, [photo.id], newEdgeId);

    await openAccount();
    await resumeMerges();
    expect(entry('dev')).toBeUndefined();
    const live = await getDb()
      .select()
      .from(schema.albumAssets)
      .where(and(eq(schema.albumAssets.albumId, album.id), isNull(schema.albumAssets.deletedAt)));
    expect(live.map((edge) => edge.assetId)).toEqual([photo.id]);
  });

  // A crash between the source's marker and the commit: the boot's pass is the first commit, and
  // copies the live edge of a photo taken out of an album and put back, not its tombstone.
  it('a photo taken out of an album and put back is in the album after a merge resumed from a crash before its commit', async () => {
    const photo = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    const album = await albums.create(sourceDb(), makeAlbumRecord({ name: 'Trip' }));
    await albumEdges.add(sourceDb(), album.id, [photo.id], newEdgeId);
    await albumEdges.remove(sourceDb(), album.id, [photo.id]);
    await albumEdges.add(sourceDb(), album.id, [photo.id], newEdgeId);
    // mergeLibrary's markers, then the crash before the target's commit.
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') }));
    await setMergeTarget(sourceDb(), marker('acc'));

    await resumeMerges();
    expect(entry('dev')).toBeUndefined();
    const live = await getDb()
      .select()
      .from(schema.albumAssets)
      .where(and(eq(schema.albumAssets.albumId, album.id), isNull(schema.albumAssets.deletedAt)));
    expect(live.map((edge) => edge.assetId)).toEqual([photo.id]);
  });
});

// Round 8: a photo an earlier pass merged into the account's photo of the same camera-roll item was
// matched again by every later pass, and copied whole once the account's photo was gone from the
// live photos. The pass's decision is recorded (merged into that photo): later passes only bring the
// device's newer edits there, and nowhere once it is gone.
describe('round 8: a resumed pass and a matched photo the account deleted since', () => {
  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    files.clear();
    storage.clear();
    applyMergeImpl.fail = false;
    await loadRegistry(async () => ({ libraries: [DEV, ACC] }));
    stores.set(SRC.dbName, makeTestDb());
    await openLibrary(ACC);
    await markFirstSyncDone(getDb()); // the account library has synced before
  });

  // Pass 1 merges the device's photo into the account's (favorite OR'd), commits, then the app
  // crashes before the files move (or a file move fails). The user then deletes that photo in the
  // account (it is in the account's trash). The boot's pass runs again: the deleted photo stays
  // deleted, and the device's photo, already merged into it, isn't copied in as a new live photo.
  it('a photo the account deleted after a pass merged the device’s copy into it stays deleted', async () => {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', filename: 'p.jpg', isFavorite: false });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]); // synced
    const devicePhotoRow = await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true });
    // Pass 1: the markers, the commit, then the crash.
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') }));
    await setMergeTarget(sourceDb(), marker('acc'));
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC, 'acc'));
    expect((await getDb().select().from(schema.assets)).map((row) => row.id)).toEqual([accountPhoto.id]);

    await repo.deleteAssets(getDb(), [accountPhoto.id]); // the user deletes it in the account

    await resumeMerges();
    expect(entry('dev')).toBeUndefined();
    const live = await getDb().select().from(schema.assets).where(isNull(schema.assets.deletedAt));
    expect(live.map((row) => row.id)).toEqual([]);
    expect(files.has(getAssetFileUri('d.jpg', TGT))).toBe(false);
    expect(devicePhotoRow.id).not.toBe(accountPhoto.id);
  });
});

// Round 8: the device library's own marker (getMergeTarget) names the library an earlier pass
// committed into. It is the authority: while that library is in the list, the device library joins
// no other, and the list's marker is set back to it (the boot then finishes that merge).
describe('round 8: a device library an earlier pass copied into a library that is still there', () => {
  const ACC2 = { id: 'acc2', owner: { kind: 'account' as const, serverId: 's1', userId: 'u2', email: 'u2@test' } };
  const TGT2 = libraryPaths('acc2');

  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    files.clear();
    storage.clear();
    applyMergeImpl.fail = false;
    await loadRegistry(async () => ({ libraries: [DEV, ACC, ACC2] }));
    stores.set(SRC.dbName, makeTestDb());
    await openLibrary(ACC);
    await markFirstSyncDone(getDb()); // the account library has synced before
  });

  // Pass 1 copies the device's photo into the account library `acc` (its file waits in the device
  // library's folder, to be uploaded by acc's backup) and crashes before the move. The list is then
  // rebuilt, and the user signs in to another account, whose library `acc2` has synced before:
  // mergeDeviceLibrary runs mergeLibrary('dev', 'acc2'): the photo `acc` holds keeps its file, and
  // nothing joins `acc2`.
  it('a photo copied into the earlier library keeps its file when the device library is merged elsewhere', async () => {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    const photo = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') }));
    await setMergeTarget(sourceDb(), marker('acc'));
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC, 'acc')); // committed, then the crash
    expect((await getDb().select().from(schema.assets))[0]).toMatchObject({ id: photo.id, isFileSynced: false });

    storage.clear(); // the list is lost and rebuilt from the databases' owners
    await loadRegistry(async () => ({ libraries: [DEV, ACC, ACC2] }));
    await closeLibrary();
    stores.set(TGT2.dbName, makeTestDb());
    await openLibrary(ACC2);
    await markFirstSyncDone(getDb()); // acc2 has synced before
    await mergeLibrary('dev', 'acc2'); // mergeDeviceLibrary, signed in as u2

    const inAcc = files.has(getAssetFileUri('a.jpg', TGT)) || files.has(getAssetFileUri('a.jpg', SRC));
    expect(inAcc).toBe(true);
    expect(await getDb().select().from(schema.assets)).toEqual([]);
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: marker('acc') });
  });
});

// Round 9: a pass committed into `acc`, then `acc` was lost before it pushed anything (removed from
// the device), and the device library joins another library of the account, `acc2`, whose first pull
// brought none of it. A copy decided by that pass whose record `acc2` has no row of, not even a
// tombstone, is copied again, with its files; new edges to such an album have their album.
describe('round 9: records an earlier library never pushed', () => {
  const ACC2 = { id: 'acc2', owner: { kind: 'account' as const, serverId: 's1', userId: 'u1', email: 'u1@test' } };
  const TGT2 = libraryPaths('acc2');
  const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');
  let edgeIds = 0;
  const newEdgeId = () => `00000000-0000-4000-8000-${String(++edgeIds).padStart(12, '0')}`;

  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    files.clear();
    storage.clear();
    applyMergeImpl.fail = false;
    await loadRegistry(async () => ({ libraries: [DEV, ACC, ACC2] }));
    stores.set(SRC.dbName, makeTestDb());
    await openLibrary(ACC);
    await markFirstSyncDone(getDb());
  });

  it('copies them again into the new library, files included, and orphans no edge', async () => {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    const photo = await devicePhoto({ filename: 'p.jpg', mediaLibraryAssetId: 'm-p' });
    const album = await albums.create(sourceDb(), makeAlbumRecord({ name: 'Trip' }));
    await albumEdges.add(sourceDb(), album.id, [photo.id], newEdgeId);
    // The pass into acc: the markers, the commit, the source's marks, then the crash before the move.
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') }));
    await setMergeTarget(sourceDb(), marker('acc'));
    const plan = await planMerge(sourceDb(), getDb(), SRC, 'acc');
    const committed = await applyMerge(getDb(), plan);
    await setMergeMarks(sourceDb(), SRC.dbName, committed);

    // acc is lost before any push; the device adds a photo to the album meanwhile.
    await closeLibrary();
    stores.delete(TGT.dbName);
    await updateRegistry(() => ({ libraries: [{ ...DEV, mergedInto: marker('acc') }, ACC2] }));
    const added = await devicePhoto({ filename: 'q.jpg', mediaLibraryAssetId: 'm-q' });
    await albumEdges.add(sourceDb(), album.id, [added.id], newEdgeId);
    stores.set(TGT2.dbName, makeTestDb());
    await openLibrary(ACC2);
    await markFirstSyncDone(getDb()); // its first pull brought nothing of acc's

    await resumeMerges(); // acc is gone: the list's marker goes
    await mergeLibrary('dev', 'acc2');

    expect(entry('dev')).toBeUndefined();
    const assetIds = (await getDb().select().from(schema.assets)).map((row) => row.id).sort();
    expect(assetIds).toEqual([photo.id, added.id].sort());
    expect((await getDb().select().from(schema.albums)).map((row) => row.id)).toEqual([album.id]);
    const edges = await getDb().select().from(schema.albumAssets).where(isNull(schema.albumAssets.deletedAt));
    expect(edges.map((edge) => edge.assetId).sort()).toEqual(assetIds);
    expect(edges.every((edge) => edge.albumId === album.id)).toBe(true);
    for (const name of ['p.jpg', 'q.jpg']) expect(files.has(getAssetFileUri(name, TGT2))).toBe(true);
    expect(await getDb().select().from(schema.outbox)).toHaveLength(5); // all of it pushes
  });
});

// Round 10: a merge into the account's library waits for its first full pull (mergeWaits) so that a
// device photo of a camera-roll item the account has is merged into the account's photo instead of
// copied beside it. The account's photo can be a record whose file never reached the cloud: it was
// imported on this iPhone by an install deleted before its backup ran (the camera-roll id is the
// iPhone's own), and the photo was imported again before the sign-in. The device library is removed
// with its folders, so the device's file moves into the account's library under the account photo's
// name, and that library's backup uploads it.
describe('round 10: a camera-roll match whose account photo has no file in the cloud', () => {
  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    deleted.length = 0;
    files.clear();
    storage.clear();
    applyMergeImpl.fail = false;
    await loadRegistry(async () => ({ libraries: [DEV, ACC] }));
    stores.set(SRC.dbName, makeTestDb());
    await openLibrary(ACC);
    await markFirstSyncDone(getDb()); // the first full pull brought the account's photo
  });

  it('keeps the device’s file for the account’s photo when the cloud has none', async () => {
    const accountPhoto = makeAssetRecord({
      ...{ mediaLibraryAssetId: 'm-r', filename: 'r.jpg', thumbnailFilename: 'r-t.jpg' },
      ...{ isFileSynced: false, isThumbnailSynced: false, isSynced: false },
    });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]); // pulled
    const again = await devicePhoto({ mediaLibraryAssetId: 'm-r', filename: 'r2.jpg', thumbnailFilename: 'r2-t.jpg' });
    expect(files.has(getAssetFileUri(again.filename, SRC))).toBe(true);

    await mergeLibrary('dev', 'acc');

    expect(entry('dev')).toBeUndefined(); // the device library and its folders are gone
    expect(deleted).toContain(SRC.dbName);
    const live = (await getDb().select().from(schema.assets)).filter((row) => row.deletedAt === null);
    expect(live.map((row) => row.mediaLibraryAssetId)).toEqual(['m-r']); // merged, not copied
    expect(live.some((row) => files.has(getAssetFileUri(row.filename, TGT)))).toBe(true);
    expect(files.has(getAssetFileUri('r.jpg', TGT))).toBe(true);
    expect(files.has(`file:///docs/${TGT.thumbnailsDir}r-t.jpg`)).toBe(true);
  });

  const unsynced = { isFileSynced: false, isThumbnailSynced: false, isSynced: false };

  // Its backup failed before (no file on this phone): with the device's copy there, it tries again.
  it('clears the sync error of the account’s photo the device’s copy goes to', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-r', filename: 'r.jpg', ...unsynced });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: 'No file on this device' }]);
    await devicePhoto({ mediaLibraryAssetId: 'm-r', filename: 'r2.jpg' });

    await mergeLibrary('dev', 'acc');

    const [row] = await getDb().select().from(schema.assets);
    expect(row).toMatchObject({ id: accountPhoto.id, syncError: null });
    expect(files.has(getAssetFileUri('r.jpg', TGT))).toBe(true);
  });

  // A pass merged the device's photo into the account's, then crashed before the files moved; the
  // account purges that photo meanwhile, not yet confirmed by the server (a restore elsewhere can
  // still beat it). The resumed pass keeps the device's copy for it, as it does for a photo kept by id.
  it('keeps the device’s copy for the account’s photo while its purge waits for the server', async () => {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-r', filename: 'r.jpg', ...unsynced });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]);
    await devicePhoto({ mediaLibraryAssetId: 'm-r', filename: 'r2.jpg' });
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') }));
    await setMergeTarget(sourceDb(), marker('acc'));
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC, 'acc')); // committed, then the crash
    await repo.deleteAssets(getDb(), [accountPhoto.id]);
    await repo.purgeAssets(getDb(), [accountPhoto.id]); // pending in the account's outbox

    await resumeMerges();

    expect(entry('dev')).toBeUndefined();
    expect(files.has(getAssetFileUri('r.jpg', TGT))).toBe(true);
  });

  // Round 13: a camera-roll match appends the device photo's note to the account photo's unless it is
  // already there (mergedNotes): the same note or whole lines of it, not a part of a line, so "Mom" is
  // merged into "Mom's birthday".
  it('round 13: a device note that is part of a word or line of the account’s note is still merged', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-r', notes: 'Mom’s birthday', ...unsynced });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]);
    await devicePhoto({ mediaLibraryAssetId: 'm-r', filename: 'r2.jpg', notes: 'Mom' });

    await mergeLibrary('dev', 'acc');

    expect(entry('dev')).toBeUndefined();
    const [row] = await getDb().select().from(schema.assets);
    expect(row!.notes).toBe('Mom’s birthday\nMom');
  });
});

// Round 12: pass 1 merges the device's photo into the account's photo X (a camera-roll match: the
// device's favorite and note go onto X), commits into `acc`, records its marks in the source, then the
// app stops before the files move. `acc` is lost before it pushed anything (as in round 9), and the
// device library joins `acc2`, a new library of the same account, whose first pull brought X as the
// server has it: not a favorite, no note. The match decision stands (X has a row), and as it was made
// in another library (its mark's `in` is acc), what pass 1 brought goes again, at the clock pass 1
// wrote it at (`brought`): per-field LWW settles it, so a merge acc never pushed is made again, and a
// later change of the account wins.
describe('round 12: a camera-roll match an earlier library never pushed', () => {
  const ACC2 = { id: 'acc2', owner: { kind: 'account' as const, serverId: 's1', userId: 'u1', email: 'u1@test' } };
  const TGT2 = libraryPaths('acc2');

  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    files.clear();
    storage.clear();
    applyMergeImpl.fail = false;
    await loadRegistry(async () => ({ libraries: [DEV, ACC, ACC2] }));
    stores.set(SRC.dbName, makeTestDb());
    await openLibrary(ACC);
    await markFirstSyncDone(getDb());
  });

  // Pass 1 into acc, its marks in the source, acc lost; acc2's first pull brings X as `pulled`.
  async function passIntoAccThenLost(accountPhoto: ReturnType<typeof makeAssetRecord>, pulled = accountPhoto) {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]);
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: marker('acc') }));
    await setMergeTarget(sourceDb(), marker('acc'));
    const plan = await planMerge(sourceDb(), getDb(), SRC, 'acc');
    const committed = await applyMerge(getDb(), plan);
    await setMergeMarks(sourceDb(), SRC.dbName, committed);
    // The match's mark holds what its merge brought to the account's photo, and the clock it did.
    const matchMark = Object.values(committed).find((made) => made.as === 'match');
    expect(matchMark).toMatchObject({
      as: 'match',
      in: 'acc',
      brought: { isFavorite: (await getDb().select().from(schema.assets))[0]!.updatedAt },
    });
    await closeLibrary();
    stores.delete(TGT.dbName);
    await updateRegistry(() => ({ libraries: [{ ...DEV, mergedInto: marker('acc') }, ACC2] }));
    stores.set(TGT2.dbName, makeTestDb());
    await openLibrary(ACC2);
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...pulled, syncError: null }]);
    await markFirstSyncDone(getDb());
  }

  // The account noted the photo on this phone after the device did (pending in acc2): it keeps its
  // note; the device's favorite, which nothing changed since, comes again.
  it('lets the account’s later change of a field win', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', isFavorite: false, notes: null });
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true, notes: 'from the beach' });
    await passIntoAccThenLost(accountPhoto);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repo.updateAsset(getDb(), accountPhoto.id, { notes: 'the account’s own' });

    await mergeLibrary('dev', 'acc2');

    const [row] = await getDb().select().from(schema.assets);
    expect(row).toMatchObject({ isFavorite: true, notes: 'the account’s own' });
  });

  // acc did push its merge: the pull brought it, and nothing is merged twice.
  it('changes nothing when the account has the merge already', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', isFavorite: false, notes: 'theirs' });
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true, notes: 'from the beach' });
    await passIntoAccThenLost(accountPhoto, { ...accountPhoto, isFavorite: true, notes: 'theirs\nfrom the beach' });

    await mergeLibrary('dev', 'acc2');

    const [row] = await getDb().select().from(schema.assets);
    expect(row).toMatchObject({ isFavorite: true, notes: 'theirs\nfrom the beach' });
    expect(await getDb().select().from(schema.outbox)).toHaveLength(0);
  });

  // Round 13: while acc2 hadn't pulled yet and the session had no tokens, the device library was open
  // again (libraryToOpen) and the same camera-roll item was imported a second time (imports don't
  // dedupe). The pass into acc2 merges the new photo into X as a fresh match (written at now) and
  // the first photo's merge again (a replay at pass 1's clock). acc never pushed (X as pulled is
  // older than pass 1's clock), so the fresh merge stacks on the redone values: both notes.
  it('round 13: a photo of the same item imported again keeps the redone note', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', isFavorite: false, notes: null });
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true, notes: 'from the beach' });
    await passIntoAccThenLost(accountPhoto);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd2.jpg', notes: 'imported again' });

    await mergeLibrary('dev', 'acc2');

    expect(entry('dev')).toBeUndefined();
    const [row] = await getDb().select().from(schema.assets);
    expect(row!.isFavorite).toBe(true);
    expect(row!.notes?.split('\n').sort()).toEqual(['from the beach', 'imported again']);
  });

  // Round 13: the pass into acc2 that redoes the match sets the source's marker to acc2 before its
  // commit (mergeRun.ts). The app is stopped inside that commit (rolled back): the marker names acc2
  // while acc2 holds nothing of the pass. "Elsewhere" is a mark made in another library (`in`), not
  // the marker, so the next launch redoes the match.
  it('round 13: a redo pass stopped inside its commit is redone at the next launch', async () => {
    const { applyMerge } = await import('../src/library/mergeLibrary');
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', isFavorite: false, notes: null });
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true, notes: 'from the beach' });
    await passIntoAccThenLost(accountPhoto);
    let inCommit!: () => void;
    const committing = new Promise<void>((resolve) => (inCommit = resolve));
    vi.mocked(applyMerge).mockImplementationOnce(() => {
      inCommit();
      return new Promise<void>(() => {}); // the app is stopped: the transaction never commits
    });
    mergeLibrary('dev', 'acc2'); // never settles: the app stops inside it
    await committing;

    // The next launch: the same databases and list; the boot resumes the merge.
    await closeLibrary();
    await openLibrary(ACC2);
    await resumeMerges();

    expect(entry('dev')).toBeUndefined();
    const [row] = await getDb().select().from(schema.assets);
    expect(row).toMatchObject({ id: accountPhoto.id, isFavorite: true, notes: 'from the beach' });
  });

  it('merges the device’s favorite and note into the account’s photo again', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', isFavorite: false, notes: null });
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true, notes: 'from the beach' });
    await passIntoAccThenLost(accountPhoto);

    await mergeLibrary('dev', 'acc2'); // mergeDeviceLibrary, signed in to the account again

    expect(entry('dev')).toBeUndefined();
    const [row] = await getDb().select().from(schema.assets);
    expect(row).toMatchObject({ id: accountPhoto.id, isFavorite: true, notes: 'from the beach' });
  });
});
