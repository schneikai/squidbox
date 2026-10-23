import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';

const stores = new Map<string, AppDb>();
const deleted: string[] = [];
const removedFolders: string[] = [];
const storage = new Map<string, string>();

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
  removeLibraryFolders: async (paths: { filesDir: string; thumbnailsDir: string }) => {
    removedFolders.push(paths.filesDir, paths.thumbnailsDir);
  },
}));

const { closeLibrary, getLibrary, openLibrary, openLibraryId } = await import('../src/library/current');
const { getRegistry, loadRegistry } = await import('../src/library/registry');
const { removeLibrary } = await import('../src/library/removeLibrary');
const { getDb } = await import('../src/sync/db/client');

const open = { id: 'open-lib', owner: { kind: 'device' as const } };
const parked = {
  id: 'parked-lib',
  owner: { kind: 'account' as const, serverId: 's1', userId: 'u1', email: 'u1@test' },
};

describe('removeLibrary', () => {
  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    deleted.length = 0;
    removedFolders.length = 0;
    storage.clear();
    await loadRegistry(async () => ({ libraries: [open, parked] }));
    await openLibrary(open);
    await repo.create(getDb(), makeAssetRecord({ isSynced: false })); // the open library has its own data
  });

  it('deletes the database, the folders and the entry', async () => {
    await removeLibrary('parked-lib');
    expect(deleted).toEqual(['library-parked-lib.db']);
    expect(removedFolders).toEqual(['libraries/parked-lib/files/', 'libraries/parked-lib/thumbnails/']);
    expect(getRegistry().libraries).toEqual([open]);
    expect(JSON.parse(storage.get('libraries')!)).toEqual({ libraries: [open] });
    expect(getLibrary().id).toBe('open-lib');
  });

  it('refuses the open library and an id that could name another path', async () => {
    await expect(removeLibrary('open-lib')).rejects.toThrow('open library cannot be removed');
    await expect(removeLibrary('../squidbox')).rejects.toThrow('Invalid library id');
    expect(deleted).toEqual([]);
    expect(getRegistry().libraries).toEqual([open, parked]);
  });
});
