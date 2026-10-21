import { eq } from 'drizzle-orm';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { sessionStoreMock } from './helpers/sessionStoreMock';
import { makeTestDb } from './helpers/testDb';
import type { Owner } from '../src/library/owner';
import type { Session } from '../src/library/session';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { setOutboxError } from '../src/sync/outbox';
import { makeRepository } from '../src/sync/repository';
import {
  getCursor,
  getKeptFor,
  getOwner,
  isFirstSyncDone,
  markFirstSyncDone,
  setCursor,
  setMergeTarget,
  setOwner,
} from '../src/sync/status';

// The device: its databases by name (a store survives close and reopen, like a file), the stored
// session and the library list in AsyncStorage.
const stores = new Map<string, AppDb>();
const failing = new Set<string>();
const full = new Set<string>(); // the browser has no room for these (web's fixed pool of files)
const deleted: string[] = [];
const storage = new Map<string, string>();
const store: { session: Session | null } = { session: null };

vi.mock('../src/sync/db/client', () => {
  let open: AppDb | null = null;
  const openAppDb = async (name: string) => {
    if (failing.has(name)) throw new Error(`cannot open ${name}`);
    if (full.has(name)) throw new Error(`no room for ${name}`);
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
vi.mock('@sentry/react-native', () => ({ captureException: () => {}, captureMessage: () => {} }));
// The boot's network check: the stored session as it is (offline).
vi.mock('../src/utils/cloud-api/initializeCloudAsync', () => ({ default: async () => store.session }));
const dbNames: string[] = []; // the databases on disk, for a registry rebuild
vi.mock('../src/library/fs', () => ({
  listDatabaseNames: async () => dbNames,
  databaseExists: async (name: string) => dbNames.includes(name),
  listFiles: async () => new Set(),
  createLibraryFolders: async () => {},
  removeLibraryFolders: async () => {},
  fileExists: async () => false,
  moveFile: async () => {},
  libraryLimitMessage: (error: Error) => (error.message.startsWith('no room') ? 'No more libraries' : null),
}));
const ids = vi.hoisted(() => ({ n: 0 }));
vi.mock('../src/utils/getNewItemId', () => ({ default: () => `id-${++ids.n}` }));
// The token refresh's request (refreshAccessTokenAsync), for a session the server rejects.
const api = vi.hoisted(() => ({ post: async (..._args: unknown[]): Promise<unknown> => ({}) }));
vi.mock('../src/utils/cloud-api/api', () => ({ default: api }));

const { bootLibrary } = await import('../src/library/bootLibrary');
const { closeLibrary, getLibrary, openLibraryId } = await import('../src/library/current');
const { resumeMerges } = await import('../src/library/mergeRun');
const { getRegistry, loadRegistry, updateLibrary } = await import('../src/library/registry');
const {
  deviceLibraryToJoin,
  libraryForSession,
  mergeDeviceLibrary,
  openLibraryForSession,
  openLibraryForSignIn,
  runPendingMerges,
  watchTokenDrops,
} = await import('../src/library/sessionLibrary');
const { switchLibrary } = await import('../src/library/switchLibrary');
const { getDb, openAppDb } = await import('../src/sync/db/client');
const { dropTokensAsync: signOut } = await import('../src/utils/cloud-api/sessionStore');
const { default: refreshAccessTokenAsync } =
  await import('../src/utils/cloud-api/authentication/refreshAccessTokenAsync');

const tokens = { accessToken: 'a', refreshToken: 'r' };
const sessionOf = (userId: string, serverId = 's1'): Session => ({
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
// The open account library's first full pull drains: the merges that waited for it run, as
// useMergeAfterFirstSync runs them.
async function firstPullDrains() {
  await markFirstSyncDone(getDb());
  await runPendingMerges();
}
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
    full.clear();
    deleted.length = 0;
    storage.clear();
    store.session = null;
    dbNames.length = 0;
    ids.n = 0;
  });

  it('boots a signed-out owner into the library rebuilt from its database, not a new one', async () => {
    const migrated = makeTestDb();
    stores.set('squidbox.db', migrated);
    dbNames.push('squidbox.db');
    await setOwner(migrated, { kind: 'account', serverId: 's1', userId: 'A', email: 'A@test' });
    store.session = { ...sessionOf('A'), tokens: null };

    await bootLibrary(switchLibrary);

    expect(getLibrary().id).toBe('squidbox');
    expect(libraryIds()).toEqual(['squidbox']);
    expect(store.session).toEqual({ ...sessionOf('A'), tokens: null });
  });

  it('boots a converted library whose owner has no serverId into it, resolved, not a new one', async () => {
    // Stored by a build from before every owner had a serverId.
    const unresolved = { kind: 'account', serverId: null, userId: 'A', email: '' } as unknown as Owner;
    const migrated = makeTestDb();
    stores.set('squidbox.db', migrated);
    await setOwner(migrated, unresolved);
    await loadRegistry(async () => ({ libraries: [{ id: 'squidbox', owner: unresolved }] }));
    store.session = sessionOf('A');

    await bootLibrary(switchLibrary);

    expect(getLibrary().id).toBe('squidbox');
    expect(libraryIds()).toEqual(['squidbox']);
    expect(openOwner()).toEqual({ kind: 'account', serverId: 's1', userId: 'A', email: 'A@test' });
    expect(await getOwner(getDb())).toEqual(openOwner());
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
    // Nothing joins before the account's library has pulled what the account holds: no camera-roll
    // item would match yet. The device library waits, free.
    expect(await assets()).toHaveLength(0);
    expect(getRegistry().libraries.find(({ id }) => id === deviceId)).toEqual({
      id: deviceId,
      owner: { kind: 'device' },
    });
    await firstPullDrains();

    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);
    expect(await getDb().select().from(schema.albums)).toHaveLength(1);
    expect(await outbox()).toHaveLength(2); // the photo and the album push with the next sync
    // The photo in another account's storage stays where it was, in the parked device library.
    expect(libraryIds()).toContain(deviceId);
    expect(await assetIdsIn(deviceId)).toEqual([photo.id, cloudOnly.id]);

    // The kept device library is A's now: another account gets nothing of it.
    await signIn(sessionOf('B'));
    await firstPullDrains();
    expect(await assets()).toHaveLength(0);
    expect(libraryIds()).toContain(deviceId);
    expect(await assetIdsIn(deviceId)).toEqual([photo.id, cloudOnly.id]);
  });

  // Round 8 (was on main): `keptFor` lived only in the library list, so a corrupt list rebuilt from
  // the databases' owners lost it, and the device library, A's already, joined B's library. The
  // device library's own database keeps it now, and the rebuilt list takes it from there.
  it('a kept device library joins no second account after the library list is rebuilt', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    await repo.createAsset(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await repo.createAsset(getDb(), makeAssetRecord({ filename: 'c.jpg', isFileSynced: true }));
    await albums.create(getDb(), makeAlbumRecord({ name: 'Trip' }));
    await signIn(sessionOf('A'));
    await firstPullDrains();
    const aId = getLibrary().id;
    await signIn(sessionOf('B'));
    await firstPullDrains();
    const bId = getLibrary().id;
    expect(await assets()).toHaveLength(0);

    // The app is closed; the stored list doesn't parse at the next launch, signed in as B.
    await closeLibrary();
    storage.set('libraries', '{not json');
    dbNames.push(...[deviceId, aId, bId].map((id) => `library-${id}.db`));
    await bootLibrary(switchLibrary);
    expect(getLibrary().id).toBe(bId);
    await resumeMerges(); // what LibraryProvider runs after the boot
    await mergeDeviceLibrary();

    expect(getRegistry().libraries.find(({ id }) => id === deviceId)).toMatchObject({ keptFor: aId });
    expect(await assets()).toHaveLength(0);
    expect(await getDb().select().from(schema.albums)).toHaveLength(0);
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
    await markFirstSyncDone(getDb()); // the account's library pulled meanwhile
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

  it('opening a library gives its failed pushes another try, and leaves its failed uploads', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const photo = await repo.createAsset(getDb(), makeAssetRecord({ isSynced: false }));
    await setOutboxError(getDb(), 'assets', [photo.id], 'schema:boom');
    await repo.setSyncError(getDb(), [photo.id], 'upload failed');

    await closeLibrary(); // the app is closed and opened again
    await open(null);
    expect(await outbox()).toMatchObject([{ recordId: photo.id, error: null }]);
    expect(await repo.countSyncErrors(getDb())).toBe(1);
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

  it('a browser with no room for B says so, leaving A open', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(sessionOf('A'));
    const aId = getLibrary().id;
    full.add('library-id-2.db');

    const error = await signIn(sessionOf('B')).catch((e) => e);

    expect(error.message).toBe('No more libraries');
    expect(getLibrary().id).toBe(aId);
    expect(deleted).toEqual(['library-id-2.db']); // its half-made file keeps no slot
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

  it('libraryForSession: the same user on another server is another account, with a library of its own', async () => {
    const onS1 = { id: 'a-s1', owner: { kind: 'account' as const, serverId: 's1', userId: 'A', email: 'A@test' } };
    await loadRegistry(async () => ({ libraries: [onS1] }));
    expect(libraryForSession(sessionOf('A'))).toBe(onS1);
    expect(libraryForSession(sessionOf('A', 's2'))).toMatchObject({
      owner: { kind: 'account', serverId: 's2', userId: 'A' },
    });
  });

  // Round 9: the installed build (df33378, mainClient.e2e's INSTALLED) recorded a kept device library
  // only in the library list (`keptFor`); its databases have no such key (its sync/status.ts writes
  // none). The update's first boot copies the list's markers into the databases (backfillMergeMarkers),
  // so a list lost after it (missing or corrupt at a launch) is rebuilt with them, and the device
  // library, A's already, stays kept for A instead of joining B's library.
  it('a device library kept by the installed build joins no second account after the list is rebuilt', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    await repo.createAsset(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await repo.createAsset(getDb(), makeAssetRecord({ filename: 'c.jpg', isFileSynced: true }));
    await albums.create(getDb(), makeAlbumRecord({ name: 'Trip' }));
    await signIn(sessionOf('A'));
    await firstPullDrains();
    const aId = getLibrary().id;
    expect(getRegistry().libraries.find(({ id }) => id === deviceId)).toMatchObject({ keptFor: aId });
    // As the installed build left the device library's database: kept in the list only, no merge
    // keys (`keptFor`, `mergeMarks:<db>`) in it.
    const deviceDb = await openAppDb(`library-${deviceId}.db`);
    for (const key of ['keptFor', `mergeMarks:library-${deviceId}.db`])
      await deviceDb.delete(schema.syncMeta).where(eq(schema.syncMeta.key, key));
    await signIn(sessionOf('B'));
    await firstPullDrains();
    const bId = getLibrary().id;

    // The update is installed and launched: the list's marker goes into the device library's database,
    // once.
    await closeLibrary();
    dbNames.push(...[deviceId, aId, bId].map((id) => `library-${id}.db`));
    await bootLibrary(switchLibrary);
    expect(await getKeptFor(deviceDb)).toBe(aId);
    expect(storage.get('mergeMarkersBackfilled')).toBe('1');
    // The stored list doesn't parse at a later launch, signed in as B.
    await closeLibrary();
    storage.set('libraries', '{not json');
    await bootLibrary(switchLibrary);
    expect(getLibrary().id).toBe(bId);
    await runPendingMerges(); // what LibraryProvider runs after the boot

    expect(getRegistry().libraries.find(({ id }) => id === deviceId)).toMatchObject({ keptFor: aId });
    expect(await assets()).toHaveLength(0);
    expect(await getDb().select().from(schema.albums)).toHaveLength(0);
  });

  // Round 10: the setup screen (FirstSyncScreen) offers Sign out while the account's first pull runs,
  // and the device library's merge waits for that pull (mergeWaits). The session stays, without
  // tokens, but its account library would hide this iPhone's photos until it pulls: this device's
  // library opens instead (libraryToOpen), at the sign-out and at every launch, until a sign-in.
  it('a sign-out on the setup screen leaves this iPhone’s photos in reach', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const photo = await repo.createAsset(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await signIn(sessionOf('A')); // the setup screen: the merge waits for the first pull
    expect(await signOut()).toEqual(tokens); // its Sign out, before the pull drained
    await open(store.session); // what CloudProvider's logoutAsync runs after dropping the tokens
    expect(openOwner()).toEqual({ kind: 'device' });

    await closeLibrary(); // the app is closed and opened again
    await open(store.session);
    await runPendingMerges(); // what LibraryProvider runs after the boot

    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);

    await signIn(sessionOf('A')); // the merge waits again, and runs once the pull drained
    await firstPullDrains();
    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);
    expect(openOwner()).toMatchObject({ kind: 'account', userId: 'A' });
  });

  // Round 10: a device library a merge pass committed into account A's library is A's from then on.
  // A's library is gone from the phone (web storage evicted, the list rebuilt) and B signs in: the
  // device library joins nothing of B's, and keeps its files, waiting for a library of A's.
  it('a device library committed into one account’s library never joins another account', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    const photo = await repo.createAsset(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    const deviceDb = await openAppDb(`library-${deviceId}.db`);
    // A's pass committed, then the app stopped before the files moved; A's library is lost since.
    await setMergeTarget(deviceDb, { library: 'gone', serverId: 's1', userId: 'A' });

    await signIn(sessionOf('B'));
    await firstPullDrains();
    expect(openOwner()).toMatchObject({ kind: 'account', userId: 'B' });
    expect(await assets()).toHaveLength(0);
    expect(libraryIds()).toContain(deviceId);
    expect(await assetIdsIn(deviceId)).toEqual([photo.id]);

    await signIn(sessionOf('A')); // a new library of A's: the device library joins it
    await firstPullDrains();
    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);
    expect(libraryIds()).not.toContain(deviceId);
  });

  // Round 11: a merge marked for A's library (a pass that committed, then failed or crashed) resumes at
  // A's next sign-in, not only at the next launch.
  it('a sign-in resumes a merge marked for the account’s library', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    const photo = await repo.createAsset(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await signIn(sessionOf('A')); // the merge waits for the first pull
    const aId = getLibrary().id;
    await markFirstSyncDone(getDb());
    const marker = { library: aId, serverId: 's1', userId: 'A' };
    await setMergeTarget(await openAppDb(`library-${deviceId}.db`), marker);
    await updateLibrary(deviceId, (library) => ({ ...library, mergedInto: marker })); // a pass that failed

    await signIn(sessionOf('A'));

    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);
    expect(libraryIds()).not.toContain(deviceId);
  });

  // The list's marker carries the account (mergeMarker.ts), so the list-only checks keep the one-account
  // rule: a device library tied to A waits to join no library of B's, and does join A's.
  it('a device library marked for one account waits to join no other account’s library, by the list', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    await repo.createAsset(getDb(), makeAssetRecord({ isFileSynced: false, isSynced: false }));
    await updateLibrary(deviceId, (library) => ({
      ...library,
      mergedInto: { library: 'gone', serverId: 's1', userId: 'A' },
    }));
    await signIn(sessionOf('B'));
    expect(deviceLibraryToJoin()).toBeNull();
    await signIn(sessionOf('A')); // its merge waits for A's first pull
    expect(deviceLibraryToJoin()?.id).toBe(deviceId);
  });

  // Round 11: the server rejects the session while the account's first pull runs (a refresh token
  // revoked by a password change, or one that expired while the app sat closed mid-setup): the pull's
  // token refresh gets a 401 and the tokens go (refreshAccessTokenAsync), as at a sign-out. Every loss
  // of the tokens opens the library for the session without them (watchTokenDrops, which
  // LibraryProvider runs from the boot on): this device's library, as the account's hasn't pulled.
  it('a session rejected during the first pull leaves this iPhone’s photos in reach', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const photo = await repo.createAsset(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await signIn(sessionOf('A')); // the setup screen: the merge waits for the first pull
    const stop = watchTokenDrops(switchLibrary);
    api.post = async () => {
      throw Object.assign(new Error('HTTP 401'), { response: { status: 401 } });
    };
    await expect(refreshAccessTokenAsync({ serverId: 's1', userId: 'A' })).rejects.toThrow('rejected');
    expect(store.session).toMatchObject({ userId: 'A', tokens: null });

    await vi.waitFor(() => expect(openOwner()).toEqual({ kind: 'device' }));
    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);
    stop();
  });

  // Round 11: the same rejection, and the user goes on in the library the app shows and adds a photo.
  // That library is this device's from the rejection on, as it is at the next launch: the photo stays
  // in the open library.
  it('a photo added after a session was rejected mid-setup is still there at the next launch', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    await repo.createAsset(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await signIn(sessionOf('A'));
    const stop = watchTokenDrops(switchLibrary);
    api.post = async () => {
      throw Object.assign(new Error('HTTP 401'), { response: { status: 401 } });
    };
    await expect(refreshAccessTokenAsync({ serverId: 's1', userId: 'A' })).rejects.toThrow('rejected');
    await vi.waitFor(() => expect(openOwner()).toEqual({ kind: 'device' }));
    stop();
    const added = await repo.createAsset(
      getDb(),
      makeAssetRecord({ filename: 'b.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );

    await closeLibrary(); // the app is closed and opened again
    await bootLibrary(switchLibrary);
    await runPendingMerges();

    expect((await assets()).map(({ id }) => id)).toContain(added.id);
  });

  // Round 11: a sign-out on the setup screen switches to this device's library (libraryToOpen); when
  // that library's database won't open (a failed migration after an update, a damaged file), the
  // session's own library opens instead (openLibraryForSession), at the sign-out and at every boot,
  // so the app boots and the user can sign in.
  it('a device library that won’t open doesn’t stop the boot after a setup sign-out', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    await repo.createAsset(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await signIn(sessionOf('A'));
    const aId = getLibrary().id;
    failing.add(`library-${deviceId}.db`);
    await signOut();
    await open(store.session); // logoutAsync's openLibraryForSignOut
    expect(getLibrary().id).toBe(aId);

    await closeLibrary(); // the app is closed and opened again
    await bootLibrary(switchLibrary);
    expect(getLibrary().id).toBe(aId);
  });
});
