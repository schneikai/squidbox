import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { deleted, resetDevice, storage } from './helpers/fakeDevice';
import * as repo from '../src/sync/assetsRepository';

const removedFolders: string[] = [];

// The device (helpers/fakeDevice): databases by name and AsyncStorage.
vi.mock('../src/sync/db/client', async () => (await import('./helpers/fakeDevice')).dbClient());
vi.mock('@react-native-async-storage/async-storage', async () => (await import('./helpers/fakeDevice')).asyncStorage());
vi.mock('../src/library/fs', async () => ({
  ...(await import('./helpers/fakeDevice')).libraryFs(),
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
    resetDevice();
    removedFolders.length = 0;
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
