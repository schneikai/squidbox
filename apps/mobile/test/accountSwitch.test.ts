import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import type { Session } from '../src/library/session';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { getCursor, getOwner, isFirstSyncDone, markFirstSyncDone, setCursor } from '../src/sync/status';

// The device: its databases by name (a store survives close and reopen, like a file), the stored
// session and the library list in AsyncStorage.
const stores = new Map<string, AppDb>();
const failing = new Set<string>();
const deleted: string[] = [];
const storage = new Map<string, string>();
const store: { session: Session | null } = { session: null };

vi.mock('../src/sync/db/client', () => {
  let open: AppDb | null = null;
  return {
    openAppDb: async (name: string) => {
      if (failing.has(name)) throw new Error(`cannot open ${name}`);
      if (!stores.has(name)) stores.set(name, makeTestDb());
      return Object.assign(Object.create(stores.get(name)!), { close: async () => {} });
    },
    deleteAppDb: async (name: string) => {
      deleted.push(name);
      stores.delete(name);
    },
    getDb: () => {
      if (!open) throw new Error('No library is open');
      return open;
    },
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
vi.mock('../src/utils/cloud-api/sessionStore', () => ({
  getSessionAsync: async () => store.session,
  setSessionAsync: async (session: Session | null) => {
    store.session = session;
  },
}));
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({ API_BASE_URL: 'https://api.test/api/v1' }));
vi.mock('../src/library/fs', () => ({ listDatabaseNames: async () => [], createLibraryFolders: async () => {} }));
const ids = vi.hoisted(() => ({ n: 0 }));
vi.mock('../src/utils/getNewItemId', () => ({ default: () => `id-${++ids.n}` }));

const { closeLibrary, getLibrary, isLibraryOpen } = await import('../src/library/current');
const { getRegistry, loadRegistry } = await import('../src/library/registry');
const { openLibraryForSession, libraryForSession } = await import('../src/library/sessionLibrary');
const { switchLibrary } = await import('../src/library/switchLibrary');
const { getDb } = await import('../src/sync/db/client');

const tokens = { accessToken: 'a', refreshToken: 'r' };
const sessionOf = (userId: string, serverId: string | null = 's1'): Session => ({
  serverId,
  userId,
  email: `${userId}@test`,
  apiBaseUrl: 'https://api.test/api/v1',
  tokens,
});

// What CloudProvider does inside withSyncPaused: store the session, then open its library.
async function signIn(session: Session | null) {
  const previous = store.session;
  store.session = session;
  await openLibraryForSession(session, previous, switchLibrary);
}
const openOwner = () => getRegistry().libraries.find(({ id }) => id === getLibrary().id)!.owner;
const assets = () => getDb().select().from(schema.assets);
const outbox = () => getDb().select().from(schema.outbox);

describe('switching libraries with the session', () => {
  beforeEach(async () => {
    if (isLibraryOpen()) await closeLibrary();
    stores.clear();
    failing.clear();
    deleted.length = 0;
    storage.clear();
    store.session = null;
    ids.n = 0;
  });

  it('signs in as A, switches to B, and comes back to A with everything intact', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await signIn(null);
    expect(openOwner()).toEqual({ kind: 'device' });
    const deviceId = getLibrary().id;

    await signIn(sessionOf('A'));
    expect(openOwner()).toEqual({ kind: 'account', serverId: 's1', userId: 'A', email: 'A@test' });
    expect(await getOwner(getDb())).toEqual(openOwner());
    const aId = getLibrary().id;
    await repo.createAsset(getDb(), makeAssetRecord({ filename: 'a.jpg', isSynced: false })); // row + outbox row
    await setCursor(getDb(), 42);
    await markFirstSyncDone(getDb());

    await signIn(sessionOf('B'));
    const bId = getLibrary().id;
    expect(bId).not.toBe(aId);
    expect(openOwner()).toMatchObject({ kind: 'account', userId: 'B' });
    expect(await assets()).toHaveLength(0);
    expect(await getCursor(getDb())).toBe(0);
    expect(await isFirstSyncDone(getDb())).toBe(false);
    await setCursor(getDb(), 7);
    const parkedA = getRegistry().libraries.find(({ id }) => id === aId)!;
    expect(parkedA.closed).toMatchObject({ pendingCount: 1, atRiskCount: 1 });

    await signIn(sessionOf('A'));
    expect(getLibrary().id).toBe(aId);
    expect(await assets()).toHaveLength(1);
    expect(await outbox()).toHaveLength(1);
    expect(await getCursor(getDb())).toBe(42);
    expect(await isFirstSyncDone(getDb())).toBe(true);
    expect(getRegistry().libraries.find(({ id }) => id === aId)!.closed).toBeUndefined();

    await signIn(sessionOf('B'));
    expect(getLibrary().id).toBe(bId);
    expect(await getCursor(getDb())).toBe(7);

    await signIn(null);
    expect(getLibrary().id).toBe(deviceId);
    expect(
      getRegistry()
        .libraries.map(({ id }) => id)
        .sort(),
    ).toEqual([aId, bId, deviceId].sort());
  });

  it('a failed open of B leaves A open with its session and no B entry', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await signIn(sessionOf('A'));
    const aId = getLibrary().id;
    await setCursor(getDb(), 42);
    failing.add('library-id-2.db'); // the next id, B's new library

    await expect(signIn(sessionOf('B'))).rejects.toThrow('cannot open library-id-2.db');

    expect(isLibraryOpen()).toBe(true);
    expect(getLibrary().id).toBe(aId);
    expect(await getCursor(getDb())).toBe(42);
    expect(store.session).toEqual(sessionOf('A'));
    expect(getRegistry().libraries.map(({ id }) => id)).toEqual([aId]);
    expect(deleted).toEqual(['library-id-2.db']);
  });

  it('a sign-out whose device library will not open keeps the old session', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await signIn(sessionOf('A'));
    failing.add('library-id-2.db');

    await expect(signIn(null)).rejects.toThrow('cannot open');

    expect(store.session).toEqual(sessionOf('A'));
    expect(openOwner()).toMatchObject({ userId: 'A' });
  });

  it('the same session opens the library it already has, resolving an unresolved owner', async () => {
    const migrated = { id: 'squidbox', owner: { kind: 'account' as const, serverId: null, userId: 'A', email: '' } };
    await loadRegistry(async () => ({ libraries: [migrated] }));
    await signIn(sessionOf('A', null));
    expect(getLibrary().id).toBe('squidbox');
    expect(openOwner()).toEqual({ kind: 'account', serverId: null, userId: 'A', email: 'A@test' });

    await signIn(sessionOf('A', 's1')); // /me resolved the server
    expect(getLibrary().id).toBe('squidbox');
    expect(openOwner()).toEqual({ kind: 'account', serverId: 's1', userId: 'A', email: 'A@test' });
    expect(await getOwner(getDb())).toEqual(openOwner());
  });

  it('libraryForSession: a session without a user opens the unresolved library, else the device one', async () => {
    const unresolved = { id: 'squidbox', owner: { kind: 'account' as const, serverId: null, userId: 'A', email: '' } };
    await loadRegistry(async () => ({ libraries: [unresolved] }));
    expect(libraryForSession({ ...sessionOf('A'), userId: null, serverId: null })).toBe(unresolved);
    storage.clear();
    await loadRegistry(async () => ({ libraries: [{ id: 'dev', owner: { kind: 'device' } }] }));
    expect(libraryForSession({ ...sessionOf('A'), userId: null, serverId: null }).id).toBe('dev');
  });
});
