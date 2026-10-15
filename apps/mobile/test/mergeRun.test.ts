import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import { libraryPaths } from '../src/library/libraryPaths';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeRepository } from '../src/sync/repository';
import getAssetFileUri from '../src/utils/assets/files/getAssetFileUri';

// The device: databases by name (a store survives close and reopen), files by uri, the list.
const stores = new Map<string, AppDb>();
const deleted: string[] = [];
const files = new Set<string>();
const storage = new Map<string, string>();

vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('../src/sync/db/client', () => {
  let open: AppDb | null = null;
  return {
    openAppDb: async (name: string) => {
      if (!stores.has(name)) stores.set(name, makeTestDb());
      return Object.assign(Object.create(stores.get(name)!), { close: async () => {} });
    },
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
  fileExists: async (uri: string) => files.has(uri),
  moveFile: async (from: string, to: string) => {
    files.delete(from);
    files.add(to);
  },
  removeLibraryFolders: async () => {},
}));
const applyMergeImpl = vi.hoisted(() => ({ fail: false }));
vi.mock('../src/library/mergeLibrary', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/library/mergeLibrary')>();
  return {
    ...original,
    applyMerge: (...args: Parameters<typeof original.applyMerge>) => {
      if (applyMergeImpl.fail) throw new Error('apply failed');
      return original.applyMerge(...args);
    },
  };
});

const { closeLibrary, isLibraryOpen, openLibrary } = await import('../src/library/current');
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
    if (isLibraryOpen()) await closeLibrary();
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

    expect(await mergeLibrary('dev', 'acc')).toEqual({ removed: true, cloudOnly: 0 });

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
  });

  it('a crash between the marker and the commit, then boot: the source still exists, everything left to add', async () => {
    await devicePhoto({ filename: 'a.jpg' });
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: 'acc' })); // the marker a crash left

    await resumeMerges();

    expect(entry('dev')).toEqual({ ...DEV, mergedInto: 'acc' });
    expect(stores.has(SRC.dbName)).toBe(true);
    expect(files.has(getAssetFileUri('a.jpg', SRC))).toBe(true);
    expect(await getDb().select().from(schema.assets)).toHaveLength(0);
  });

  it('a crash after the commit, then boot: the files move and the source goes, only when nothing is left', async () => {
    const { applyMerge, planMerge } = await import('../src/library/mergeLibrary');
    const a = await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await updateLibrary('dev', (library) => ({ ...library, mergedInto: 'acc' }));
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC)); // committed, then the crash
    // Something new on the device before the boot: not in the account yet, so the source stays.
    const later = await devicePhoto({ filename: 'later.jpg', mediaLibraryAssetId: 'm-later' });
    await resumeMerges();
    expect(entry('dev')).toEqual({ ...DEV, mergedInto: 'acc' });
    expect(files.has(getAssetFileUri('a.jpg', SRC))).toBe(true);

    // Added by the next answer; then a boot finishes the merge.
    await applyMerge(getDb(), await planMerge(sourceDb(), getDb(), SRC));
    await resumeMerges();
    expect((await getDb().select().from(schema.assets)).map((row) => row.id).sort()).toEqual([a.id, later.id].sort());
    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
    expect(files.has(getAssetFileUri('later.jpg', TGT))).toBe(true);
    expect(entry('dev')).toBeUndefined();
    expect(deleted).toEqual([SRC.dbName]);
  });

  it("keeps a source that holds photos living in another account's storage", async () => {
    await devicePhoto({ filename: 'a.jpg', mediaLibraryAssetId: 'm-a' });
    await repo.createAsset(
      sourceDb(),
      makeAssetRecord({ mediaLibraryAssetId: 'm-cloud', filename: 'cloud.jpg', isFileSynced: true }),
    );

    expect(await mergeLibrary('dev', 'acc')).toEqual({ removed: false, cloudOnly: 1 });

    expect(entry('dev')).toEqual(DEV); // listed, no marker
    expect(stores.has(SRC.dbName)).toBe(true);
    expect(await getDb().select().from(schema.assets)).toHaveLength(1);
    expect(files.has(getAssetFileUri('a.jpg', TGT))).toBe(true);
  });

  it('a marker whose target is gone is just cleared', async () => {
    storage.clear();
    await loadRegistry(async () => ({ libraries: [{ ...DEV, mergedInto: 'gone' }, ACC] }));
    await resumeMerges();
    expect(entry('dev')).toEqual(DEV);
  });
});
