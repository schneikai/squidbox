import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { sessionStoreMock } from './helpers/sessionStoreMock';
import { makeTestDb } from './helpers/testDb';
import type { Session } from '../src/library/session';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { makeRepository } from '../src/sync/repository';
import { getCursor, getOwner, isFirstSyncDone, markFirstSyncDone, setCursor, setOwner } from '../src/sync/status';

// The device: its databases by name (a store survives close and reopen, like a file), the stored
// session and the library list in AsyncStorage.
const stores = new Map<string, AppDb>();
const failing = new Set<string>();
const deleted: string[] = [];
const storage = new Map<string, string>();
const store: { session: Session | null } = { session: null };

vi.mock('../src/sync/db/client', () => {
  let open: AppDb | null = null;
  const openAppDb = async (name: string) => {
    if (failing.has(name)) throw new Error(`cannot open ${name}`);
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
vi.mock('../src/utils/cloud-api/sessionStore', () => sessionStoreMock(store));
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({ API_BASE_URL: 'https://api.test/api/v1' }));
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('@sentry/react-native', () => ({ captureException: () => {} }));
// The boot's network check: the stored session as it is (offline).
vi.mock('../src/utils/cloud-api/initializeCloudAsync', () => ({ default: async () => store.session }));
const dbNames: string[] = []; // the databases on disk, for a registry rebuild
vi.mock('../src/library/fs', () => ({
  listDatabaseNames: async () => dbNames,
  listFiles: async () => new Set(),
  createLibraryFolders: async () => {},
  removeLibraryFolders: async () => {},
  fileExists: async () => false,
  moveFile: async () => {},
}));
const ids = vi.hoisted(() => ({ n: 0 }));
vi.mock('../src/utils/getNewItemId', () => ({ default: () => `id-${++ids.n}` }));

const { bootLibrary } = await import('../src/library/bootLibrary');
const { closeLibrary, getLibrary, openLibraryId } = await import('../src/library/current');
const { resumeMerges } = await import('../src/library/mergeRun');
const { getRegistry, loadRegistry } = await import('../src/library/registry');
const { libraryForSession, mergeDeviceLibrary, openLibraryForSession, openLibraryForSignIn } =
  await import('../src/library/sessionLibrary');
const { switchLibrary } = await import('../src/library/switchLibrary');
const { getDb, openAppDb } = await import('../src/sync/db/client');
const { dropTokensAsync: signOut } = await import('../src/utils/cloud-api/sessionStore');

const tokens = { accessToken: 'a', refreshToken: 'r' };
const sessionOf = (userId: string, serverId: string | null = 's1'): Session => ({
  serverId,
  userId,
  email: `${userId}@test`,
  apiBaseUrl: 'https://api.test/api/v1',
  tokens,
});

// The boot's open for a stored session (or none), and what CloudProvider's loginAsync does inside
// withSyncPaused with the session the server answered with.
async function open(session: Session | null) {
  store.session = session;
  await openLibraryForSession(session, switchLibrary);
}
const signIn = (session: Session) => openLibraryForSignIn(session, switchLibrary);
const albums = makeRepository('albums', schema.albums);
const libraryIds = () => getRegistry().libraries.map(({ id }) => id);
const openOwner = () => getRegistry().libraries.find(({ id }) => id === getLibrary().id)!.owner;
const assets = () => getDb().select().from(schema.assets);
const outbox = () => getDb().select().from(schema.outbox);
const assetIdsIn = async (libraryId: string) =>
  (await (await openAppDb(`library-${libraryId}.db`)).select().from(schema.assets)).map(({ id }) => id);

describe('switching libraries with the session', () => {
  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    stores.clear();
    failing.clear();
    deleted.length = 0;
    storage.clear();
    store.session = null;
    dbNames.length = 0;
    ids.n = 0;
  });

  it('boots a signed-out install from before libraries into its account library, not a new device one', async () => {
    const migrated = makeTestDb();
    stores.set('squidbox.db', migrated);
    dbNames.push('squidbox.db');
    await setOwner(migrated, { kind: 'account', serverId: 's1', userId: 'A', email: 'A@test' });

    await bootLibrary(switchLibrary); // the list is rebuilt, which stores the owner's token-less session

    expect(getLibrary().id).toBe('squidbox');
    expect(libraryIds()).toEqual(['squidbox']);
    expect(store.session).toEqual({ ...sessionOf('A'), tokens: null });
  });

  it('signs in as A, switches to B, and comes back to A with everything intact', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    expect(openOwner()).toEqual({ kind: 'device' });
    const deviceId = getLibrary().id;

    expect(await signIn(sessionOf('A'))).toBe(true);
    expect(store.session).toEqual(sessionOf('A'));
    expect(libraryIds()).not.toContain(deviceId); // empty, so it joined A's library and went
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

    await signIn(sessionOf('A'));
    expect(getLibrary().id).toBe(aId);
    expect(await assets()).toHaveLength(1);
    expect(await outbox()).toHaveLength(1);
    expect(await getCursor(getDb())).toBe(42);
    expect(await isFirstSyncDone(getDb())).toBe(true);

    await signIn(sessionOf('B'));
    expect(getLibrary().id).toBe(bId);
    expect(await getCursor(getDb())).toBe(7);
    expect(libraryIds().sort()).toEqual([aId, bId].sort());
  });

  it('signing in adds what this device holds to the account and keeps nothing of another account', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    const photo = await repo.createAsset(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    const cloudOnly = await repo.createAsset(getDb(), makeAssetRecord({ filename: 'c.jpg', isFileSynced: true }));
    await albums.create(getDb(), makeAlbumRecord({ name: 'Trip' }));

    await signIn(sessionOf('A'));

    expect(openOwner()).toMatchObject({ kind: 'account', userId: 'A' });
    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);
    expect(await getDb().select().from(schema.albums)).toHaveLength(1);
    expect(await outbox()).toHaveLength(2); // the photo and the album push with the next sync
    // The photo in another account's storage stays where it was, in the parked device library.
    expect(libraryIds()).toContain(deviceId);
    expect(await assetIdsIn(deviceId)).toEqual([photo.id, cloudOnly.id]);

    // The kept device library is A's now: another account gets nothing of it.
    await signIn(sessionOf('B'));
    expect(await assets()).toHaveLength(0);
    expect(libraryIds()).toContain(deviceId);
    expect(await assetIdsIn(deviceId)).toEqual([photo.id, cloudOnly.id]);
  });

  it('a merge that fails leaves the device library parked, signed in anyway; the next boot retries it', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    const photo = await repo.createAsset(getDb(), makeAssetRecord({ isFileSynced: false, isSynced: false }));
    failing.add(`library-${deviceId}.db`); // the merge's second connection to it

    await signIn(sessionOf('A'));

    expect(openOwner()).toMatchObject({ kind: 'account', userId: 'A' });
    expect(await assets()).toHaveLength(0);
    expect(libraryIds()).toContain(deviceId);
    expect(store.session).toEqual(sessionOf('A'));

    failing.clear();
    await closeLibrary(); // the app is closed and opened again
    await open(store.session);
    await resumeMerges(); // what the boot runs after the library opened
    await mergeDeviceLibrary();
    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);
    expect(libraryIds()).not.toContain(deviceId);
  });

  it('a sign-out keeps the library open, with what is added meanwhile, and the next boot reopens it', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    await signIn(sessionOf('A'));
    const aId = getLibrary().id;
    await setCursor(getDb(), 42);

    expect(await signOut()).toEqual(tokens);
    expect(store.session).toEqual({ ...sessionOf('A'), tokens: null });
    expect(getLibrary().id).toBe(aId);
    expect(libraryIds()).toEqual([aId]); // no device library comes back
    await repo.createAsset(getDb(), makeAssetRecord({ isSynced: false })); // while signed out
    expect(await signOut()).toBeNull(); // nothing more to revoke

    await closeLibrary(); // the app is closed and opened again
    await open(store.session);
    expect(getLibrary().id).toBe(aId);
    expect(await getCursor(getDb())).toBe(42);
    expect(await outbox()).toHaveLength(1);

    expect(await signIn(sessionOf('A'))).toBe(false); // the owner signs in again: no switch, the outbox is still there
    expect(store.session).toEqual(sessionOf('A'));
    expect(getLibrary().id).toBe(aId);
    expect(await outbox()).toHaveLength(1);
  });

  it('signing in as B while A is signed out parks A with its pending changes until A signs in again', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    await signIn(sessionOf('A'));
    const aId = getLibrary().id;
    await repo.createAsset(getDb(), makeAssetRecord({ isSynced: false }));
    await signOut();

    await signIn(sessionOf('B'));
    const bId = getLibrary().id;
    expect(bId).not.toBe(aId);
    expect(await assets()).toHaveLength(0);
    expect(libraryIds().sort()).toEqual([aId, bId].sort());

    await signIn(sessionOf('A'));
    expect(getLibrary().id).toBe(aId);
    expect(await outbox()).toHaveLength(1);
  });

  it('a failed open of B leaves A open with its session (never stored for B) and no B entry', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(sessionOf('A'));
    const aId = getLibrary().id;
    await setCursor(getDb(), 42);
    failing.add('library-id-2.db'); // the next id, B's new library

    await expect(signIn(sessionOf('B'))).rejects.toThrow("Couldn't create the library: cannot open library-id-2.db");

    expect(getLibrary().id).toBe(aId);
    expect(await getCursor(getDb())).toBe(42);
    expect(store.session).toEqual(sessionOf('A'));
    expect(getRegistry().libraries.map(({ id }) => id)).toEqual([aId]);
    expect(deleted).toEqual(['library-id-2.db']);
  });

  it("a failed open of B whose A won't reopen either keeps B's error and leaves no library open", async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(sessionOf('A'));
    const aId = getLibrary().id;
    failing.add('library-id-2.db');
    failing.add(`library-${aId}.db`);

    await expect(signIn(sessionOf('B'))).rejects.toThrow("Couldn't create the library: cannot open library-id-2.db");

    expect(openLibraryId()).toBeNull();
    expect(store.session).toEqual(sessionOf('A'));
    expect(libraryIds()).toEqual([aId]);
  });

  it('the same session opens the library it already has, resolving an unresolved owner', async () => {
    const migrated = { id: 'squidbox', owner: { kind: 'account' as const, serverId: null, userId: 'A', email: '' } };
    await loadRegistry(async () => ({ libraries: [migrated] }));
    await open(sessionOf('A', null));
    expect(getLibrary().id).toBe('squidbox');
    expect(openOwner()).toEqual({ kind: 'account', serverId: null, userId: 'A', email: 'A@test' });

    await open(sessionOf('A', 's1')); // /me resolved the server
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
