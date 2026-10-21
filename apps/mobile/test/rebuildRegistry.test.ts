import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import type { AppDb } from '../src/sync/db/driver';
import { getOwner, setKeptFor, setMergeTarget, setOwner } from '../src/sync/status';

const device: { names: string[] } = { names: [] };
// Databases by name: each test's "disk". A rebuild opens and closes them, so every open hands out a
// fresh handle on the same (shared) store.
const stores = new Map<string, AppDb>();
const opened: string[] = [];

vi.mock('../src/library/fs', () => ({ listDatabaseNames: async () => device.names }));
vi.mock('../src/sync/db/client', () => ({
  withAppDb: async (name: string, use: (db: AppDb) => Promise<unknown>) => {
    opened.push(name);
    try {
      return await use(stores.get(name)!);
    } finally {
      opened.push(`closed ${name}`);
    }
  },
}));

const { rebuildRegistry } = await import('../src/library/rebuildRegistry');

describe('rebuildRegistry', () => {
  beforeEach(() => {
    stores.clear();
    opened.length = 0;
    device.names = [];
  });

  function disk(name: string): AppDb {
    if (!stores.has(name)) stores.set(name, makeTestDb());
    device.names = [...stores.keys(), 'squidbox.db-journal'];
    return stores.get(name)!;
  }

  it('a fresh install has no libraries', async () => {
    expect(await rebuildRegistry()).toEqual({ libraries: [] });
  });

  it('lists every library with the owner its database recorded, opening each once', async () => {
    const account = { kind: 'account' as const, serverId: 's1', userId: 'u9', email: 'u9@test' };
    await setOwner(disk('library-abc.db'), account);
    await setOwner(disk('squidbox.db'), { kind: 'device' });

    const registry = await rebuildRegistry();

    expect(registry.libraries).toEqual([
      { id: 'abc', owner: account },
      { id: 'squidbox', owner: { kind: 'device' } },
    ]);
    expect(opened).toEqual(['library-abc.db', 'closed library-abc.db', 'squidbox.db', 'closed squidbox.db']);
  });

  // The device library's own markers are the authority (mergeRun.ts): one joined to a library stays
  // with it, never merged into whatever account is signed in at the rebuild.
  it('restores what a device library joins or joined, from its own database', async () => {
    const merging = disk('library-dev.db');
    await setOwner(merging, { kind: 'device' });
    await setMergeTarget(merging, { library: 'acc', serverId: 's1', userId: 'u1' });
    const kept = disk('library-old.db');
    await setOwner(kept, { kind: 'device' });
    await setKeptFor(kept, 'acc');

    expect((await rebuildRegistry()).libraries).toEqual([
      { id: 'dev', owner: { kind: 'device' }, mergedInto: { library: 'acc', serverId: 's1', userId: 'u1' } },
      { id: 'old', owner: { kind: 'device' }, keptFor: 'acc' },
    ]);
  });

  it("makes a database without an owner this device's library, so its data stays in reach", async () => {
    const legacy = disk('squidbox.db');
    expect(await rebuildRegistry()).toEqual({ libraries: [{ id: 'squidbox', owner: { kind: 'device' } }] });
    expect(await getOwner(legacy)).toBeNull(); // nothing on disk changes
  });

  it('skips a database without an owner when this device already has its library', async () => {
    const empty = disk('library-new.db');
    await setOwner(disk('library-abc.db'), { kind: 'device' });

    expect(await rebuildRegistry()).toEqual({ libraries: [{ id: 'abc', owner: { kind: 'device' } }] });
    expect(await getOwner(empty)).toBeNull();
  });
});
