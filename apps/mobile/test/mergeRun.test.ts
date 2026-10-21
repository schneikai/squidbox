import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import { libraryPaths } from '../src/library/libraryPaths';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeRepository } from '../src/sync/repository';
import { getMergeTarget, setMergeTarget } from '../src/sync/status';
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
  // The open's own sweep (current.ts).
  removeAssetFiles: async (
    names: { filename?: string; thumbnailFilename?: string }[],
    paths: { filesDir: string; thumbnailsDir: string },
  ) => {
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

const { closeLibrary, openLibrary, openLibraryId } = await import('../src/library/current');
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
    expect(entry('dev')).toEqual(DEV); // its merge failed before the commit
    expect(entry('other')).toEqual(OTHER); // still cleared, after the failure
  });

  it('a marker whose target is gone is just cleared', async () => {
    storage.clear();
    await loadRegistry(async () => ({ libraries: [{ ...DEV, mergedInto: 'gone' }, ACC] }));
    await setMergeTarget(sourceDb(), 'gone'); // a pass had copied records
    await resumeMerges();
    expect(entry('dev')).toEqual(DEV);
    expect(await getMergeTarget(sourceDb())).toBeNull(); // so the device library sweeps its purges again
  });
});

const { sweepPurgedFiles } = await import('../src/sync/sweepPurgedFiles');

describe('a failed pass after an earlier one committed (round 5, adversarial)', () => {
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

  // BUG (round 5): mergeLibrary clears the merge marker in the source's database on ANY failed pass
  // (mergeRun.ts, the catch around planMerge/applyMerge), also when an EARLIER pass already committed
  // records into the account. Pass 1 copied the photo into the account and crashed before moving its
  // files; the device library, opened again while the session was lost, purged it and kept its files
  // (the marker: that purge can still lose in the account, the round-3 bug 3 scenario). The next pass
  // fails before its commit and clears the marker, so the device library's next sweep (at its next
  // open) removes the files at once, though the account still holds the photo live, without its files,
  // and the purge has yet to reach it, where a restore on another device can still beat it.
  // Expected: the files stay (the marker stays while any pass has committed); actual: they are removed.
  it.fails('a failed pass keeps the marker of an earlier pass that committed: the device purge keeps its files', async () => {
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
