import { and, eq, isNull } from 'drizzle-orm';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import { libraryPaths } from '../src/library/libraryPaths';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeRepository } from '../src/sync/repository';
import { getMergeTarget, markFirstSyncDone, setMergeTarget } from '../src/sync/status';
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
const { getRegistry, loadRegistry, updateLibrary } = await import('../src/library/registry');
const { mergeLibrary, resumeMerges } = await import('../src/library/mergeRun');
const { getDb } = await import('../src/sync/db/client');

const albums = makeRepository('albums', schema.albums);
const DEV = { id: 'dev', owner: { kind: 'device' as const } };
const ACC = { id: 'acc', owner: { kind: 'account' as const, serverId: 's1', userId: 'u1', email: 'u1@test' } };
const SRC = libraryPaths('dev');
const TGT = libraryPaths('acc');
const sourceDb = () => stores.get(SRC.dbName)!;
const entry = (id: string) => getRegistry().libraries.find((library) => library.id === id);

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
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: 'acc' })); // the marker a crash left

    await resumeMerges();

    expect((await getDb().select().from(schema.assets)).map((row) => row.id)).toEqual([a.id]);
    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
    expect(entry('dev')).toBeUndefined();
    expect(deleted).toEqual([SRC.dbName]);
  });

  it('a crash after the commit, then boot: the files move, what was added meanwhile joins too, the source goes', async () => {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    const a = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: 'acc' }));
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC)); // committed, then the crash
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
      libraries: [{ ...DEV, mergedInto: 'acc' }, ACC, { ...OTHER, mergedInto: 'gone' }],
    }));
    await closeLibrary();
    await openLibrary(DEV); // the session was lost: the marked device library opened again

    await resumeMerges();
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: 'acc' }); // waits for a boot that opens another
    expect(entry('other')).toEqual(OTHER);

    await closeLibrary();
    await openLibrary(ACC);
    await devicePhoto();
    await updateLibrary('other', (library) => ({ ...library, mergedInto: 'gone' }));
    applyMergeImpl.fail = true;
    await resumeMerges();
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: 'acc' }); // failed: the next boot tries again
    expect(entry('other')).toEqual(OTHER); // still cleared, after the failure
  });

  it('the list’s marker of a merge whose target is gone is cleared; the source’s own stays', async () => {
    storage.clear();
    await loadRegistry(async () => ({ libraries: [{ ...DEV, mergedInto: 'gone' }, ACC] }));
    await setMergeTarget(sourceDb(), 'gone'); // a pass had copied records
    await resumeMerges();
    expect(entry('dev')).toEqual(DEV);
    expect(await getMergeTarget(sourceDb())).toBe('gone'); // what it copied may be in the account: purges wait
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
  });

  // Pass 1 copied the photo into the account and crashed before moving its files; the device library,
  // opened again while the session was lost, purged it and kept its files (the marker: that purge can
  // still lose in the account). The next pass fails before its commit: the markers stay as they were,
  // so the device library's next sweep still keeps the files.
  it('a failed pass keeps the marker of an earlier pass that committed: the device purge keeps its files', async () => {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    const a = await devicePhoto({ filename: 'a.jpg', thumbnailFilename: 'a-t.jpg', mediaLibraryAssetId: 'm-a' });
    // Pass 1: the markers, every record committed into the account, then the crash.
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: 'acc' }));
    await setMergeTarget(sourceDb(), 'acc');
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC));

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
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // The sign-in's pass: the markers, every record committed into the account, then the crash.
  async function firstPassThenCrash() {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: 'acc' }));
    await setMergeTarget(sourceDb(), 'acc');
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC));
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

  // "Target gone": an earlier pass copied the device library into a library that left the list. Its
  // records may be in the account, so the merge into a new library waits for that library's first
  // full pull (the boot tries again), which brings them; then the device's edits replay by id.
  it('a merge after the target is gone waits for the new target’s first full pull', async () => {
    const photo = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await setMergeTarget(sourceDb(), 'gone');
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: 'acc' }));
    await resumeMerges();
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: 'acc' }); // waits, for the next boot
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
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: 'acc' }));
    await setMergeTarget(sourceDb(), 'acc');

    await resumeMerges();
    expect(entry('dev')).toBeUndefined();
    const live = await getDb()
      .select()
      .from(schema.albumAssets)
      .where(and(eq(schema.albumAssets.albumId, album.id), isNull(schema.albumAssets.deletedAt)));
    expect(live.map((edge) => edge.assetId)).toEqual([photo.id]);
  });
});
