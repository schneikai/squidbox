import { and, eq, isNull, lte } from 'drizzle-orm';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { FUZZ_MEDIA, mergeLosses, seedAccountPhotos } from './helpers/mergeFuzz';
import { prng } from './helpers/prng';
import { makeTestDb } from './helpers/testDb';
import { libraryPaths } from '../src/library/libraryPaths';
import type { Registry } from '../src/library/registry';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeRepository } from '../src/sync/repository';
import {
  anyMergePushed,
  clearFirstSyncDone,
  getKeptFor,
  getMergeMarks,
  getMergeTarget,
  markFirstSyncDone,
  setMergeTarget,
} from '../src/sync/status';
import getAssetFileUri from '../src/utils/assets/files/getAssetFileUri';

// The device: databases by name (a store survives close and reopen), files by uri, the list.
const stores = new Map<string, AppDb>();
const deleted: string[] = [];
const files = new Set<string>();
const storage = new Map<string, string>();
const failingMoves = vi.hoisted(() => new Set<string>()); // moves that throw

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
    if (failingMoves.has(from)) throw new Error(`could not move ${from}`);
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

vi.mock('../src/sync/worker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/sync/worker')>()),
  requestSync: vi.fn(),
}));

const { closeLibrary, openLibrary, openLibraryId, sweepOpenLibrary } = await import('../src/library/current');
const { getRegistry, loadRegistry, updateLibrary, updateRegistry } = await import('../src/library/registry');
const { mergeLibrary, resumeMerges } = await import('../src/library/mergeRun');
const { getDb } = await import('../src/sync/db/client');
const { requestSync } = await import('../src/sync/worker');
const { planMerge: plannedMerge } = await import('../src/library/mergeLibrary');
const plans = () => vi.mocked(plannedMerge).mock.calls.length;

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

// A fresh device: these libraries listed, the device library's database empty, no files.
async function resetLibraries(libraries: Registry['libraries'] = [DEV, ACC]) {
  if (openLibraryId()) await closeLibrary();
  stores.clear();
  deleted.length = 0;
  files.clear();
  storage.clear();
  await loadRegistry(async () => ({ libraries }));
  stores.set(SRC.dbName, makeTestDb());
}
// ... with the account's library open, its first full pull done.
async function resetToAccount(libraries: Registry['libraries'] = [DEV, ACC]) {
  await resetLibraries(libraries);
  await openLibrary(ACC);
  await markFirstSyncDone(getDb());
}

// A pass committed into the open account library `library`, then the app stops before the files move.
async function commitPass(library = 'acc') {
  const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
  await updateLibrary('dev', (entry) => ({ ...entry, mergedInto: marker(library) }));
  await setMergeTarget(sourceDb(), marker(library));
  await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC, libraryPaths(library)));
}

// The open account library pushes everything (the server took it all), then what the end of that
// push runs (usePendingMerges): a merge waiting for it finishes.
async function pushAndFinish() {
  await getDb().delete(schema.outbox);
  await resumeMerges();
}

afterEach(() => {
  failingMoves.clear();
  applyMergeImpl.fail = false;
});

describe('mergeLibrary / resumeMerges', () => {
  beforeEach(() => resetToAccount());

  // The source learns the pass's decisions, and goes, only once the account's library has pushed
  // them: until then it waits, marked, holding no marks, across a relaunch too (sync-design §8).
  it('adds the device library to the account, and removes it once the account has pushed it', async () => {
    const a = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await albums.create(sourceDb(), makeAlbumRecord({ name: 'Trip' }));

    vi.mocked(requestSync).mockClear();
    await mergeLibrary('dev', 'acc');

    expect(requestSync).toHaveBeenCalled(); // the pass's rows push right after it
    expect((await getDb().select().from(schema.assets)).map((row) => row.id)).toEqual([a.id]);
    expect(await getDb().select().from(schema.albums)).toHaveLength(1);
    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
    expect(files.has(getAssetFileUri('a.jpg', SRC))).toBe(false);
    const waiting = async () => {
      expect(entry('dev')).toEqual({ ...DEV, mergedInto: { ...marker('acc'), committed: true } });
      expect(await getMergeTarget(sourceDb())).toEqual({ ...marker('acc'), committed: true });
      expect(stores.has(SRC.dbName)).toBe(true);
      expect(await getMergeMarks(sourceDb(), SRC.dbName)).toEqual({});
    };
    await waiting();

    // A relaunch before the push: with the source as the pass left it, the boot plans nothing, and
    // the source still waits.
    await closeLibrary();
    await openLibrary(ACC);
    const planned = plans();
    await resumeMerges();
    expect(plans()).toBe(planned);
    await waiting();

    // The push: what usePendingMerges watches turns true, and the merges due run.
    expect(await anyMergePushed(getDb())).toBe(false);
    await getDb().delete(schema.outbox);
    expect(await anyMergePushed(getDb())).toBe(true);
    await resumeMerges();
    expect(entry('dev')).toBeUndefined();
    expect(deleted).toEqual([SRC.dbName]);
    expect(await getMergeMarks(getDb(), SRC.dbName)).toEqual({});
    expect(await anyMergePushed(getDb())).toBe(false);
  });

  // A pass's rows the account has pushed, and a later edit of the account still waiting: the source
  // goes (only the pass's rows count).
  it('finishes once the pass’s rows have pushed, whatever the account edited since', async () => {
    const a = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await mergeLibrary('dev', 'acc');
    await getDb().delete(schema.outbox);
    await repo.updateAsset(getDb(), a.id, { notes: 'edited in the account' });

    await resumeMerges();

    expect(entry('dev')).toBeUndefined();
  });

  // While the push waits, a pass plans again only for what it hasn't done: files a crash kept from
  // moving, or a source edited since (opened again while the session had no tokens).
  it('plans again while the push waits only for files left to move or an edited source', async () => {
    const a = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await commitPass(); // committed, then the app stopped before the move
    let planned = plans();
    await resumeMerges();
    expect(plans()).toBe(planned + 1);
    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: { ...marker('acc'), committed: true } });

    planned = plans();
    await resumeMerges();
    expect(plans()).toBe(planned);

    await repo.updateAsset(sourceDb(), a.id, { notes: 'edited on the device' });
    await resumeMerges();
    expect(plans()).toBe(planned + 1);
    expect((await getDb().select().from(schema.assets))[0]!.notes).toBe('edited on the device');
    await resumeMerges();
    expect(plans()).toBe(planned + 1);

    await pushAndFinish();
    expect(entry('dev')).toBeUndefined();
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
    await pushAndFinish();

    expect((await getDb().select().from(schema.assets)).map((row) => row.id)).toEqual([a.id]);
    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
    expect(entry('dev')).toBeUndefined();
    expect(deleted).toEqual([SRC.dbName]);
  });

  it('a crash after the commit, then boot: the files move, what was added meanwhile joins too, the source goes', async () => {
    const a = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await commitPass();
    const later = await devicePhoto({ filename: 'later.jpg', mediaLibraryAssetId: 'm-later' });

    await resumeMerges();
    await pushAndFinish();

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
    await pushAndFinish();

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

  beforeEach(() => resetToAccount());

  // Pass 1 copied the photo into the account and crashed before moving its files; the device library,
  // opened again while the session was lost, purged it and kept its files (the marker: that purge can
  // still lose in the account). The next pass fails before its commit: the markers stay as they were,
  // so the device library's next sweep still keeps the files.
  it('a failed pass keeps the marker of an earlier pass that committed: the device purge keeps its files', async () => {
    const a = await devicePhoto({ filename: 'a.jpg', thumbnailFilename: 'a-t.jpg', mediaLibraryAssetId: 'm-a' });
    await commitPass(); // pass 1: the markers, every record committed into the account, then the crash

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

  beforeEach(() => resetLibraries());

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
const albumEdges = makeEdgeRepository('album_assets', schema.albumAssets, 'albumId');

// A pass that committed, then a crash (or a failed file move) before the source went; the device
// library may be opened and edited again meanwhile (the session was lost), and the account's library
// syncs. The boot's resumed pass must add what the device did since, and only that: the target keeps
// per source record the newest clock a committed pass merged (getMergeMarks).
describe('a merge pass run again (a crash, a failed file move)', () => {
  let edgeIds = 0;
  const newEdgeId = () => `00000000-0000-4000-8000-${String(++edgeIds).padStart(12, '0')}`;

  beforeEach(() => resetToAccount());
  afterEach(() => {
    vi.useRealTimers();
  });

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
  // boot and the end of that pull try again (usePendingMerges).
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
    await pushAndFinish();
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
    await commitPass(); // the sign-in's pass, then the crash

    vi.setSystemTime(new Date('2026-10-21T10:05:00Z')); // set right again
    await openDevice();
    await repo.updateAsset(getDb(), kept.id, { notes: 'The one for the cover' });

    await openAccount();
    await resumeMerges();
    await pushAndFinish();
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
    await commitPass(); // the sign-in's pass, then the crash
    expect((await accountAsset(accountPhoto.id)).isFavorite).toBe(true);

    // The account library pushes that, then pulls the unfavorite another device made later.
    await getDb().delete(schema.outbox);
    const later = (await accountAsset(accountPhoto.id)).updatedAt + 60_000;
    await upsertRows(getDb(), 'assets', schema.assets, [
      { ...(await accountAsset(accountPhoto.id)), isFavorite: false, updatedAt: later },
    ]);

    await resumeMerges(); // pushed: the merge finishes
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
    await commitPass(); // the sign-in's pass, then the crash

    await openDevice();
    await albumEdges.remove(getDb(), album.id, [photo.id]);
    await albumEdges.add(getDb(), album.id, [photo.id], newEdgeId);

    await openAccount();
    await resumeMerges();
    await pushAndFinish();
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
    await pushAndFinish();
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
  beforeEach(() => resetToAccount());

  // Pass 1 merges the device's photo into the account's (favorite OR'd), commits, then the app
  // crashes before the files move (or a file move fails). The user then deletes that photo in the
  // account (it is in the account's trash). The boot's pass runs again: the deleted photo stays
  // deleted, and the device's photo, already merged into it, isn't copied in as a new live photo.
  it('a photo the account deleted after a pass merged the device’s copy into it stays deleted', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', filename: 'p.jpg', isFavorite: false });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]); // synced
    const devicePhotoRow = await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true });
    await commitPass(); // pass 1: the markers, the commit, then the crash
    expect((await getDb().select().from(schema.assets)).map((row) => row.id)).toEqual([accountPhoto.id]);

    await repo.deleteAssets(getDb(), [accountPhoto.id]); // the user deletes it in the account

    await resumeMerges();
    await pushAndFinish();
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

  beforeEach(() => resetToAccount([DEV, ACC, ACC2]));

  // Pass 1 copies the device's photo into the account library `acc` (its file waits in the device
  // library's folder, to be uploaded by acc's backup) and crashes before the move. The list is then
  // rebuilt, and the user signs in to another account, whose library `acc2` has synced before:
  // mergeDeviceLibrary runs mergeLibrary('dev', 'acc2'): the photo `acc` holds keeps its file, and
  // nothing joins `acc2`.
  it('a photo copied into the earlier library keeps its file when the device library is merged elsewhere', async () => {
    const photo = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await commitPass(); // committed, then the crash
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
// brought none of it. The source learned nothing from that pass (it learns a decision once the
// target has pushed it), so the pass into `acc2` is an ordinary one: everything is copied, with its
// files; new edges to the album have their album.
describe('round 9: records an earlier library never pushed', () => {
  const ACC2 = { id: 'acc2', owner: { kind: 'account' as const, serverId: 's1', userId: 'u1', email: 'u1@test' } };
  const TGT2 = libraryPaths('acc2');
  let edgeIds = 0;
  const newEdgeId = () => `00000000-0000-4000-8000-${String(++edgeIds).padStart(12, '0')}`;

  beforeEach(() => resetToAccount([DEV, ACC, ACC2]));

  it('copies them again into the new library, files included, and orphans no edge', async () => {
    const photo = await devicePhoto({ filename: 'p.jpg', mediaLibraryAssetId: 'm-p' });
    const album = await albums.create(sourceDb(), makeAlbumRecord({ name: 'Trip' }));
    await albumEdges.add(sourceDb(), album.id, [photo.id], newEdgeId);
    await commitPass(); // the pass into acc, then the crash before the move
    expect(await getMergeMarks(sourceDb(), SRC.dbName)).toEqual({});

    // acc is lost before any push; the device adds a photo to the album meanwhile.
    await closeLibrary();
    stores.delete(TGT.dbName);
    await updateRegistry(() => ({ libraries: [{ ...DEV, mergedInto: marker('acc') }, ACC2] }));
    const added = await devicePhoto({ filename: 'q.jpg', mediaLibraryAssetId: 'm-q' });
    await albumEdges.add(sourceDb(), album.id, [added.id], newEdgeId);
    stores.set(TGT2.dbName, makeTestDb());
    await openLibrary(ACC2);
    await markFirstSyncDone(getDb()); // its first pull brought nothing of acc's

    await resumeMerges(); // acc is gone: nothing resumes
    await mergeLibrary('dev', 'acc2');
    expect(await getDb().select().from(schema.outbox)).toHaveLength(5); // all of it pushes
    await pushAndFinish();

    expect(entry('dev')).toBeUndefined();
    const assetIds = (await getDb().select().from(schema.assets)).map((row) => row.id).sort();
    expect(assetIds).toEqual([photo.id, added.id].sort());
    expect((await getDb().select().from(schema.albums)).map((row) => row.id)).toEqual([album.id]);
    const edges = await getDb().select().from(schema.albumAssets).where(isNull(schema.albumAssets.deletedAt));
    expect(edges.map((edge) => edge.assetId).sort()).toEqual(assetIds);
    expect(edges.every((edge) => edge.albumId === album.id)).toBe(true);
    for (const name of ['p.jpg', 'q.jpg']) expect(files.has(getAssetFileUri(name, TGT2))).toBe(true);
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
  beforeEach(() => resetToAccount());

  it('keeps the device’s file for the account’s photo when the cloud has none', async () => {
    const accountPhoto = makeAssetRecord({
      ...{ mediaLibraryAssetId: 'm-r', filename: 'r.jpg', thumbnailFilename: 'r-t.jpg' },
      ...{ isFileSynced: false, isThumbnailSynced: false, isSynced: false },
    });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]); // pulled
    const again = await devicePhoto({ mediaLibraryAssetId: 'm-r', filename: 'r2.jpg', thumbnailFilename: 'r2-t.jpg' });
    expect(files.has(getAssetFileUri(again.filename, SRC))).toBe(true);

    await mergeLibrary('dev', 'acc');
    await pushAndFinish();

    expect(entry('dev')).toBeUndefined(); // the device library and its folders are gone
    expect(deleted).toContain(SRC.dbName);
    const live = (await getDb().select().from(schema.assets)).filter((row) => row.deletedAt === null);
    expect(live.map((row) => row.mediaLibraryAssetId)).toEqual(['m-r']); // merged, not copied
    expect(live.some((row) => files.has(getAssetFileUri(row.filename, TGT)))).toBe(true);
    expect(files.has(getAssetFileUri('r.jpg', TGT))).toBe(true);
    expect(files.has(`file:///docs/${TGT.thumbnailsDir}r-t.jpg`)).toBe(true);
  });

  const unsynced = { isFileSynced: false, isThumbnailSynced: false, isSynced: false };

  // Round 17: a pass that writes nothing but moves the device's file into the account's folders (a
  // match with nothing to merge) commits its decisions and has joined the account's library: the
  // marker says so before the move, so a move that fails half-way never reopens the device library.
  it('a pass that only moves files marks the device library committed before the move', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-r', filename: 'r.jpg', ...unsynced });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]);
    await devicePhoto({ mediaLibraryAssetId: 'm-r', filename: 'r2.jpg', thumbnailFilename: 'r2-t.jpg' });
    failingMoves.add(`file:///docs/${SRC.thumbnailsDir}r2-t.jpg`);

    await expect(mergeLibrary('dev', 'acc')).rejects.toThrow('could not move');

    expect(await getDb().select().from(schema.outbox)).toEqual([]); // nothing written
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: { ...marker('acc'), committed: true } });
    expect(await getMergeTarget(sourceDb())).toEqual({ ...marker('acc'), committed: true });
    failingMoves.clear();
    await resumeMerges();
    expect(entry('dev')).toBeUndefined();
    expect(files.has(getAssetFileUri('r.jpg', TGT))).toBe(true);
  });

  // Round 19: two device photos of an item whose account photo has no file in the cloud: the first
  // gives it its file, and the second's stays in the device library. No later pass plans a move into
  // a destination the account's library has (it would commit again and wait for later rows), so the
  // merge finishes once the pass's rows pushed, whatever the account edited since.
  it('a second photo of a matched item plans no move once the account’s photo has its file', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-r', filename: 'r.jpg', ...unsynced });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]);
    await devicePhoto({ mediaLibraryAssetId: 'm-r', filename: 'r1.jpg', isFavorite: false, notes: null });
    await devicePhoto({ mediaLibraryAssetId: 'm-r', filename: 'r2.jpg', isFavorite: false, notes: null });
    const copied = await devicePhoto({ mediaLibraryAssetId: 'm-a', filename: 'a.jpg' });
    await mergeLibrary('dev', 'acc');
    expect(files.has(getAssetFileUri('r.jpg', TGT))).toBe(true);
    await getDb().delete(schema.outbox); // the pass's rows push
    await repo.updateAsset(getDb(), copied.id, { notes: 'edited in the account' });

    const { applyMerge } = await import('../src/library/mergeLibrary');
    const applied = vi.mocked(applyMerge).mock.calls.length;
    await resumeMerges();

    expect(vi.mocked(applyMerge).mock.calls).toHaveLength(applied);
    expect(entry('dev')).toBeUndefined();
  });

  // Round 19: a pass that adds no outbox rows (here it only moves the files a crash left) keeps what
  // the earlier passes wait for, so a later edit of the account doesn't hold the merge. Until its
  // files moved, its commit isn't counted as pushed (usePendingMerges).
  it('a pass that only moves files keeps the rows the merge waits for', async () => {
    const photo = await devicePhoto({ mediaLibraryAssetId: 'm-a', filename: 'a.jpg' });
    await commitPass(); // committed, then the app stopped before the move
    await getDb().delete(schema.outbox); // pushed
    expect(await anyMergePushed(getDb())).toBe(false); // its files haven't moved
    await repo.updateAsset(getDb(), photo.id, { notes: 'edited in the account' });

    await resumeMerges();

    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
    expect(entry('dev')).toBeUndefined();
  });

  // Round 18: a pass that writes nothing but moves the device's copy under a matched record's names
  // commits its decisions first. Its move fails, the account deletes the record meanwhile, and the
  // retry keeps the decision: the device's photo isn't copied in as a new live photo.
  it('a pass that only moves files keeps its match when the account deletes the record before the retry', async () => {
    const accountPhoto = makeAssetRecord({
      mediaLibraryAssetId: 'm-r',
      filename: 'r.jpg',
      thumbnailFilename: 'r-t.jpg',
      ...unsynced,
      isFavorite: false,
      notes: null,
    });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]);
    const photo = await devicePhoto({ mediaLibraryAssetId: 'm-r', filename: 'r2.jpg', thumbnailFilename: 'r2-t.jpg' });
    failingMoves.add(`file:///docs/${SRC.thumbnailsDir}r2-t.jpg`);
    await expect(mergeLibrary('dev', 'acc')).rejects.toThrow('could not move');
    expect(await getMergeMarks(getDb(), SRC.dbName)).toMatchObject({
      [`assets:${photo.id}`]: { as: 'match', into: accountPhoto.id },
    });

    // Another device deletes the account's photo; this one pulls the tombstone.
    await upsertRows(getDb(), 'assets', schema.assets, [
      { ...accountPhoto, deletedAt: 5000, updatedAt: 5000, syncError: null },
    ]);
    failingMoves.clear();
    await resumeMerges();
    await pushAndFinish();

    expect(entry('dev')).toBeUndefined();
    const rows = await getDb().select().from(schema.assets);
    expect(rows.map((row) => [row.id, row.deletedAt])).toEqual([[accountPhoto.id, 5000]]);
  });

  // Round 20: a copied photo whose move failed, backed up by hand before the next launch (its backup
  // found no file there): the next pass moves its file, and its backup tries again.
  it('a copied photo’s sync error goes once the next pass moves its file', async () => {
    const photo = await devicePhoto({ mediaLibraryAssetId: 'm-a', filename: 'a.jpg' });
    failingMoves.add(getAssetFileUri('a.jpg', SRC));
    await expect(mergeLibrary('dev', 'acc')).rejects.toThrow('could not move');
    await repo.setSyncError(getDb(), [photo.id], 'No file on this device');
    failingMoves.clear();

    await resumeMerges();

    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
    expect((await getDb().select().from(schema.assets))[0]).toMatchObject({ id: photo.id, syncError: null });
  });

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
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-r', filename: 'r.jpg', ...unsynced });
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]);
    await devicePhoto({ mediaLibraryAssetId: 'm-r', filename: 'r2.jpg' });
    await commitPass(); // committed, then the crash
    await repo.deleteAssets(getDb(), [accountPhoto.id]);
    await repo.purgeAssets(getDb(), [accountPhoto.id]); // pending in the account's outbox

    await resumeMerges();
    expect(files.has(getAssetFileUri('r.jpg', TGT))).toBe(true);
    await pushAndFinish();

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

    const [row] = await getDb().select().from(schema.assets);
    expect(row!.notes).toBe('Mom’s birthday\nMom');
  });
});

// Round 15: pass 1 merges the device's photo into the account's photo X (a camera-roll match: the
// device's favorite and note go onto X) and commits into `acc`; the app stops before the files move,
// and `acc` is lost before it pushed anything (as in round 9). The source learns a decision only once
// the target has pushed it, so it holds nothing of that pass: the pass into `acc2`, a new library of
// the same account whose first pull brought X as the server has it, is an ordinary one, and the match
// is made again at now (nothing of pass 1 reached the server).
describe('round 15: a camera-roll match an earlier library never pushed', () => {
  const ACC2 = { id: 'acc2', owner: { kind: 'account' as const, serverId: 's1', userId: 'u1', email: 'u1@test' } };
  const TGT2 = libraryPaths('acc2');

  beforeEach(() => resetToAccount([DEV, ACC, ACC2]));

  // Pass 1 into acc, acc lost; acc2's first pull brings X as `pulled`.
  async function passIntoAccThenLost(accountPhoto: ReturnType<typeof makeAssetRecord>, pulled = accountPhoto) {
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...accountPhoto, syncError: null }]);
    await commitPass();
    expect(await getMergeMarks(sourceDb(), SRC.dbName)).toEqual({});
    await closeLibrary();
    stores.delete(TGT.dbName);
    await updateRegistry(() => ({ libraries: [{ ...DEV, mergedInto: marker('acc') }, ACC2] }));
    stores.set(TGT2.dbName, makeTestDb());
    await openLibrary(ACC2);
    await upsertRows(getDb(), 'assets', schema.assets, [{ ...pulled, syncError: null }]);
    await markFirstSyncDone(getDb());
  }
  const accountRow = async () => (await getDb().select().from(schema.assets))[0]!;

  it('merges the device’s favorite and note into the account’s photo again', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', isFavorite: false, notes: null });
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true, notes: 'from the beach' });
    await passIntoAccThenLost(accountPhoto);

    await mergeLibrary('dev', 'acc2'); // mergeDeviceLibrary, signed in to the account again
    await pushAndFinish();

    expect(entry('dev')).toBeUndefined();
    expect(await accountRow()).toMatchObject({ id: accountPhoto.id, isFavorite: true, notes: 'from the beach' });
  });

  // The account noted the photo on this phone since (pending in acc2): the match appends to it.
  it('merges onto what the account changed since', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', isFavorite: false, notes: null });
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true, notes: 'from the beach' });
    await passIntoAccThenLost(accountPhoto);
    await repo.updateAsset(getDb(), accountPhoto.id, { notes: 'the account’s own' });

    await mergeLibrary('dev', 'acc2');

    expect(await accountRow()).toMatchObject({ isFavorite: true, notes: 'the account’s own\nfrom the beach' });
  });

  // acc pushed its merge but was lost before the source learned it: the pull brought the merge, and
  // the match made again finds it there.
  it('changes nothing when the account has the merge already', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', isFavorite: false, notes: 'theirs' });
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true, notes: 'from the beach' });
    await passIntoAccThenLost(accountPhoto, { ...accountPhoto, isFavorite: true, notes: 'theirs\nfrom the beach' });

    await mergeLibrary('dev', 'acc2');

    expect(await accountRow()).toMatchObject({ isFavorite: true, notes: 'theirs\nfrom the beach' });
    expect(await getDb().select().from(schema.outbox)).toHaveLength(0);
  });

  // Round 13: the same camera-roll item imported a second time while the device library was open
  // again (imports don't dedupe): both photos are merged into X, both notes kept.
  it('round 13: a photo of the same item imported again keeps both notes', async () => {
    const accountPhoto = makeAssetRecord({ mediaLibraryAssetId: 'm-x', isFavorite: false, notes: null });
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd.jpg', isFavorite: true, notes: 'from the beach' });
    await passIntoAccThenLost(accountPhoto);
    await devicePhoto({ mediaLibraryAssetId: 'm-x', filename: 'd2.jpg', notes: 'imported again' });

    await mergeLibrary('dev', 'acc2');

    const row = await accountRow();
    expect(row.isFavorite).toBe(true);
    expect(row.notes?.split('\n').sort()).toEqual(['from the beach', 'imported again']);
  });

  // Round 13: the app is stopped inside the commit of the pass into acc2 (rolled back): the next
  // launch's pass makes the match.
  it('round 13: a pass stopped inside its commit is made at the next launch', async () => {
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
    await pushAndFinish();

    expect(entry('dev')).toBeUndefined();
    expect(await accountRow()).toMatchObject({ id: accountPhoto.id, isFavorite: true, notes: 'from the beach' });
  });
});

// Round 19 (seeded fuzz): a device library of photos of camera-roll items the account holds (with or
// without a file in the cloud), in an album, merged while passes fail (a file move, the commit), the
// account pushes all or part of its outbox, deletes photos, edits them, uploads their files, another
// device adds photos of the same items, and the device library is opened and edited while it waits.
// Then the account pushes and a later edit of the account waits in its outbox, which holds no merge
// (only the rows the passes wrote do). The merge completes and nothing of the device library is lost.
describe('round 19: seeded merges', () => {
  const SEEDS = 150;

  async function seeded(seed: number): Promise<string[]> {
    const rand = prng(seed);
    const { pick } = rand;
    const r = rand.next;
    failingMoves.clear();
    applyMergeImpl.fail = false;
    await resetToAccount();
    const accountRows = await seedAccountPhotos(getDb(), rand, (name) => files.add(getAssetFileUri(name, TGT)));
    const device: schema.AssetRow[] = [];
    for (let i = 0; i < 5; i++) {
      const photo = await devicePhoto({
        ...{ mediaLibraryAssetId: pick(FUZZ_MEDIA), filename: `dev${i}.jpg`, thumbnailFilename: `dev${i}-t.jpg` },
        ...{ isFavorite: r() < 0.3, notes: r() < 0.3 ? `dev note ${i}` : null },
      });
      device.push(photo as schema.AssetRow);
    }
    if (r() < 0.3) await repo.deleteAssets(sourceDb(), [device[4]!.id]);
    const album = makeAlbumRecord({ name: 'Trip' });
    await albums.create(sourceDb(), album);
    await albumEdges.add(
      sourceDb(),
      album.id,
      device.slice(0, 3).map((photo) => photo.id),
      () => crypto.randomUUID(),
    );
    let liveDevice = (await sourceDb().select().from(schema.assets)).filter((row) => row.deletedAt === null);
    const accountAssets = () => getDb().select().from(schema.assets);

    for (let step = 0; step < 8; step++) {
      const op = r();
      if (op < 0.35) {
        if (r() < 0.3) failingMoves.add(getAssetFileUri(pick(device).filename, SRC));
        applyMergeImpl.fail = r() < 0.15;
        await mergeLibrary('dev', 'acc').catch(() => {});
        failingMoves.clear();
        applyMergeImpl.fail = false;
      } else if (op < 0.45) {
        await pushAndFinish();
      } else if (op < 0.55) {
        // A push cut short: the older half of the outbox.
        const ids = (await getDb().select().from(schema.outbox)).map((row) => row.id).sort((a, b) => a - b);
        const cut = ids[Math.floor(ids.length / 2)];
        if (cut !== undefined) await getDb().delete(schema.outbox).where(lte(schema.outbox.id, cut));
        if (r() < 0.5) await resumeMerges();
      } else if (op < 0.65) {
        // Another device deletes one of the account's photos (pulled).
        const [row] = await getDb()
          .select()
          .from(schema.assets)
          .where(eq(schema.assets.id, pick(accountRows).id));
        if (row && row.deletedAt === null)
          await upsertRows(getDb(), 'assets', schema.assets, [
            { ...row, deletedAt: 9000 + step, updatedAt: 9000 + step },
          ]);
      } else if (op < 0.75) {
        const rows = (await accountAssets()).filter((row) => row.deletedAt === null);
        if (rows.length) await repo.updateAsset(getDb(), pick(rows).id, { isFavorite: true });
      } else if (op < 0.85) {
        // The account's backup uploads a photo's file.
        const rows = (await accountAssets()).filter((row) => row.deletedAt === null && !row.isFileSynced);
        if (rows.length)
          await repo.updateAsset(getDb(), pick(rows).id, {
            isFileSynced: true,
            isThumbnailSynced: true,
            isSynced: true,
          });
      } else if (op < 0.9) {
        // Another device adds a photo of a camera-roll item the device has (pulled).
        const row = makeAssetRecord({
          ...{ mediaLibraryAssetId: pick(['m4', 'm5']), filename: `late${step}.jpg` },
          ...{ thumbnailFilename: `late${step}-t.jpg`, updatedAt: 8000 + step },
        });
        await upsertRows(getDb(), 'assets', schema.assets, [{ ...row, syncError: null }]);
      } else if (op < 0.95) {
        // The device library opens again (the session had no tokens) and is edited, unless joined.
        if (entry('dev') && !entry('dev')!.mergedInto?.committed) {
          await closeLibrary();
          await openLibrary(DEV);
          const rows = (await getDb().select().from(schema.assets)).filter((row) => row.deletedAt === null);
          if (rows.length) {
            const photo = pick(rows);
            const edit = r();
            if (edit < 0.3) await repo.updateAsset(getDb(), photo.id, { notes: `dev edit ${step}` });
            else if (edit < 0.6) await repo.toggleFavorite(getDb(), photo.id);
            else await repo.deleteAssets(getDb(), [photo.id]);
          }
          liveDevice = (await getDb().select().from(schema.assets)).filter((row) => row.deletedAt === null);
          await closeLibrary();
          await openLibrary(ACC);
        }
      } else {
        await closeLibrary();
        await openLibrary(ACC);
        await resumeMerges();
      }
    }

    // The account pushes, then the user edits a photo there (a row after every pass's), at each boot.
    const problems: string[] = [];
    for (let boot = 0; boot < 4 && entry('dev'); boot++) {
      await getDb().delete(schema.outbox);
      await getDb()
        .insert(schema.outbox)
        .values({ collection: 'assets', recordId: `later-${boot}`, op: 'upsert', payload: {}, updatedAt: 1 });
      await resumeMerges();
      if (entry('dev') && !entry('dev')!.mergedInto)
        await mergeLibrary('dev', 'acc').catch((error) => problems.push(`a pass threw ${error}`));
    }
    const at = `seed ${seed}`;
    if (entry('dev')) problems.push(`${at}: the device library stays ${JSON.stringify(entry('dev'))}`);
    const inAlbum = device.slice(0, 3).map((photo) => photo.id);
    problems.push(
      ...(await mergeLosses(getDb(), liveDevice, inAlbum, (name) => files.has(getAssetFileUri(name, TGT)), at)),
    );
    return problems;
  }

  it(`completes, losing nothing, over ${SEEDS} seeds`, async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // the passes made to fail
    const problems: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) problems.push(...(await seeded(seed)));
    vi.mocked(console.warn).mockRestore();
    expect(problems.slice(0, 20)).toEqual([]);
  }, 120_000);
});
