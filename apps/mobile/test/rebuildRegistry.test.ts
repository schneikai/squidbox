import { sql } from 'drizzle-orm';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import type { AppDb } from '../src/sync/db/driver';
import { getOwner, setOwner } from '../src/sync/status';

type Session = {
  serverId: string | null;
  userId: string | null;
  email: string | null;
  apiBaseUrl: string;
  tokens: { accessToken: string; refreshToken: string } | null;
};
const device: { names: string[]; session: Session | null } = { names: [], session: null };
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
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({ API_BASE_URL: 'https://api.test/api/v1' }));
vi.mock('../src/utils/cloud-api/sessionStore', () => ({
  getSession: () => device.session,
  updateSession: async (change: (session: Session | null) => Session | null) => {
    device.session = change(device.session);
    return device.session;
  },
}));

const { rebuildRegistry } = await import('../src/library/rebuildRegistry');

// What an install before libraries recorded at sign-in (nothing writes it any more).
const setLastSyncUser = (db: AppDb, userId: string) =>
  db.run(sql`insert into "sync_meta" ("key", "value") values ('lastSyncUserId', ${userId})`);

const tokens = { accessToken: 'a', refreshToken: 'r' };
const signedInAs = (userId: string): Session => ({
  serverId: 's1',
  userId,
  email: `${userId}@test`,
  apiBaseUrl: 'https://api.test/api/v1',
  tokens,
});

describe('rebuildRegistry', () => {
  beforeEach(() => {
    stores.clear();
    opened.length = 0;
    device.names = [];
    device.session = null;
  });

  function disk(name: string): AppDb {
    if (!stores.has(name)) stores.set(name, makeTestDb());
    device.names = [...stores.keys(), 'squidbox.db-journal'];
    return stores.get(name)!;
  }

  it('a fresh install has no libraries', async () => {
    expect(await rebuildRegistry()).toEqual({ libraries: [] });
    expect(device.session).toBeNull();
  });

  it("a signed-in install becomes that account's library, owner written into the database", async () => {
    await setLastSyncUser(disk('squidbox.db'), 'u1');
    device.session = signedInAs('u1');

    const registry = await rebuildRegistry();

    const owner = { kind: 'account', serverId: null, userId: 'u1', email: 'u1@test' };
    expect(registry).toEqual({ libraries: [{ id: 'squidbox', owner }] });
    expect(await getOwner(disk('squidbox.db'))).toEqual(owner);
    expect(opened).toEqual(['squidbox.db', 'closed squidbox.db']);
    expect(device.session).toEqual(signedInAs('u1'));
  });

  it('an install that never synced becomes the device library', async () => {
    disk('squidbox.db');

    expect(await rebuildRegistry()).toEqual({ libraries: [{ id: 'squidbox', owner: { kind: 'device' } }] });
    expect(await getOwner(disk('squidbox.db'))).toEqual({ kind: 'device' });
  });

  it('a signed-out account owner gets a token-less session, email unknown until /me', async () => {
    await setLastSyncUser(disk('squidbox.db'), 'u1');

    const registry = await rebuildRegistry();

    expect(registry.libraries[0]!.owner).toEqual({ kind: 'account', serverId: null, userId: 'u1', email: '' });
    expect(device.session).toEqual({
      serverId: null,
      userId: 'u1',
      email: '',
      apiBaseUrl: 'https://api.test/api/v1',
      tokens: null,
    });
  });

  it('a session for someone else does not lend its email and is kept', async () => {
    await setLastSyncUser(disk('squidbox.db'), 'u1');
    device.session = signedInAs('u2');

    const registry = await rebuildRegistry();

    expect(registry.libraries[0]!.owner).toEqual({ kind: 'account', serverId: null, userId: 'u1', email: '' });
    expect(device.session).toEqual(signedInAs('u2'));
  });

  it('reads the owner a library already recorded and lists every library', async () => {
    const owner = { kind: 'account' as const, serverId: 's1', userId: 'u9', email: 'u9@test' };
    await setOwner(disk('library-abc.db'), owner);
    await setLastSyncUser(disk('squidbox.db'), 'u1');

    const registry = await rebuildRegistry();

    expect(registry.libraries).toEqual([
      { id: 'abc', owner },
      { id: 'squidbox', owner: { kind: 'account', serverId: null, userId: 'u1', email: '' } },
    ]);
  });

  it('runs to the same result again after a crash before the list was written', async () => {
    await setLastSyncUser(disk('squidbox.db'), 'u1');

    const first = await rebuildRegistry();
    device.session!.tokens = tokens; // the user signed in meanwhile; the owner is already in the database
    const second = await rebuildRegistry();

    expect(second).toEqual(first);
    expect(await getOwner(disk('squidbox.db'))).toEqual(first.libraries[0]!.owner);
  });
});
