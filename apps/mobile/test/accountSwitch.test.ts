import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { dbNames, deleted, faults, files, resetDevice, storage, stores } from './helpers/fakeDevice';
import { sessionStoreMock } from './helpers/sessionStoreMock';
import { makeTestDb } from './helpers/testDb';
import type { Session } from '../src/library/session';
import * as repo from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import { setOutboxError } from '../src/sync/outbox';
import { makeRepository } from '../src/sync/repository';
import {
  getCursor,
  getOwner,
  isFirstSyncDone,
  markFirstSyncDone,
  setCursor,
  setMergeTarget,
  setOwner,
} from '../src/sync/status';

// The device (helpers/fakeDevice): its databases by name, the library files, and the stored session
// and the library list in AsyncStorage.
const store: { session: Session | null } = { session: null };

vi.mock('../src/sync/db/client', async () => (await import('./helpers/fakeDevice')).dbClient());
vi.mock('@react-native-async-storage/async-storage', async () => (await import('./helpers/fakeDevice')).asyncStorage());
vi.mock('../src/utils/cloud-api/sessionStore', () => sessionStoreMock(store));
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({ API_BASE_URL: 'https://api.test/api/v1' }));
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('@sentry/react-native', () => ({ captureException: () => {}, captureMessage: () => {} }));
// The boot's network check: the stored session as it is (offline).
vi.mock('../src/utils/cloud-api/initializeCloudAsync', () => ({ default: async () => store.session }));
vi.mock('../src/library/fs', async () => (await import('./helpers/fakeDevice')).libraryFs());
const ids = vi.hoisted(() => ({ n: 0 }));
vi.mock('../src/utils/getNewItemId', () => ({ default: () => `id-${++ids.n}` }));
// The token refresh's request (refreshAccessTokenAsync), for a session the server rejects.
const api = vi.hoisted(() => ({ post: async (..._args: unknown[]): Promise<unknown> => ({}) }));
vi.mock('../src/utils/cloud-api/api', () => ({ default: api }));

const { bootLibrary } = await import('../src/library/bootLibrary');
const { closeLibrary, getLibrary, librarySweepsSettled, openLibraryId } = await import('../src/library/current');
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
const { fullResync, syncSettled } = await import('../src/sync/worker');
const { libraryPaths } = await import('../src/library/libraryPaths');
const { getAssetFileUri } = await import('../src/utils/assets/assetStorage');
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
// usePendingMerges runs them.
async function firstPullDrains() {
  await markFirstSyncDone(getDb());
  await runPendingMerges();
}
// The open account library pushes everything: a merge waiting for that push finishes, as
// usePendingMerges runs it.
async function pushes() {
  await getDb().delete(schema.outbox);
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
  const watching: (() => void)[] = []; // watchTokenDrops subscriptions, ended after each test
  afterEach(() => {
    for (const stop of watching.splice(0)) stop();
  });

  beforeEach(async () => {
    if (openLibraryId()) await closeLibrary();
    await librarySweepsSettled(); // a sweep the last test's library started removes nothing of this one's
    resetDevice();
    store.session = null;
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
    await repo.create(getDb(), makeAssetRecord({ filename: 'a.jpg', isSynced: false })); // row + outbox row
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
    const photo = await repo.create(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    const cloudOnly = await repo.create(getDb(), makeAssetRecord({ filename: 'c.jpg', isFileSynced: true }));
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
    await pushes(); // then the merge finishes: the device library is kept for A
    expect(getRegistry().libraries.find(({ id }) => id === deviceId)).toMatchObject({ keptFor: getLibrary().id });
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

  // `keptFor` is in the device library's own database, so a list rebuilt from disk (a corrupt list
  // rebuilt from the databases' owners) keeps it: the device library, A's already, joins no library
  // of B's.
  it('a kept device library joins no second account after the library list is rebuilt', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    await repo.create(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await repo.create(getDb(), makeAssetRecord({ filename: 'c.jpg', isFileSynced: true }));
    await albums.create(getDb(), makeAlbumRecord({ name: 'Trip' }));
    await signIn(sessionOf('A'));
    await firstPullDrains();
    await pushes();
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
    const photo = await repo.create(getDb(), makeAssetRecord({ isFileSynced: false, isSynced: false }));
    faults.failingOpens.add(`library-${deviceId}.db`); // the merge's second connection to it

    await signIn(sessionOf('A'));

    expect(openOwner()).toMatchObject({ kind: 'account', userId: 'A' });
    expect(await assets()).toHaveLength(0);
    expect(libraryIds()).toContain(deviceId);
    expect(store.session).toEqual(sessionOf('A'));

    faults.failingOpens.clear();
    await closeLibrary(); // the app is closed and opened again
    await open(store.session);
    await markFirstSyncDone(getDb()); // the account's library pulled meanwhile
    await resumeMerges(); // what the boot runs after the library opened
    await mergeDeviceLibrary();
    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);
    await pushes();
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
    await repo.create(getDb(), makeAssetRecord({ isSynced: false })); // while signed out
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
    const photo = await repo.create(getDb(), makeAssetRecord({ isSynced: false }));
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
    await repo.create(getDb(), makeAssetRecord({ isSynced: false }));
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
    faults.failingOpens.add('library-id-2.db'); // the next id, B's new library

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
    faults.fullOpens.add('library-id-2.db');

    const error = await signIn(sessionOf('B')).catch((e) => e);

    expect(error.message).toBe('No more libraries');
    expect(getLibrary().id).toBe(aId);
    expect(deleted).toEqual(['library-id-2.db']); // its half-made file keeps no slot
  });

  it("a failed open of B whose A won't reopen either keeps B's error and leaves no library open", async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(sessionOf('A'));
    const aId = getLibrary().id;
    faults.failingOpens.add('library-id-2.db');
    faults.failingOpens.add(`library-${aId}.db`);

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

  // The setup screen (FirstSyncScreen) offers Sign out while the account's first pull runs,
  // and the device library's merge waits for that pull (mergeWaits). The session stays, without
  // tokens, but its account library would hide this iPhone's photos until it pulls: this device's
  // library opens instead (libraryToOpen), at the sign-out and at every launch, until a sign-in.
  it('a sign-out on the setup screen leaves this iPhone’s photos in reach', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const photo = await repo.create(
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

  // A device library a merge pass committed into account A's library is A's from then on.
  // A's library is gone from the phone (web storage evicted, the list rebuilt) and B signs in: the
  // device library joins nothing of B's, and keeps its files, waiting for a library of A's.
  it('a device library committed into one account’s library never joins another account', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    const photo = await repo.create(
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
    await pushes();
    expect(libraryIds()).not.toContain(deviceId);
  });

  // A merge marked for A's library (a pass that committed, then failed or crashed) resumes at
  // A's next sign-in, not only at the next launch.
  it('a sign-in resumes a merge marked for the account’s library', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    const photo = await repo.create(
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
    await pushes();
    expect(libraryIds()).not.toContain(deviceId);
  });

  // The list's marker carries the account (mergeMarker.ts), so the list-only checks keep the one-account
  // rule: a device library tied to A waits to join no library of B's, and does join A's.
  it('a device library marked for one account waits to join no other account’s library, by the list', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    await repo.create(getDb(), makeAssetRecord({ isFileSynced: false, isSynced: false }));
    await updateLibrary(deviceId, (library) => ({
      ...library,
      mergedInto: { library: 'gone', serverId: 's1', userId: 'A' },
    }));
    await signIn(sessionOf('B'));
    expect(deviceLibraryToJoin()).toBeNull();
    await signIn(sessionOf('A')); // its merge waits for A's first pull
    expect(deviceLibraryToJoin()?.id).toBe(deviceId);
  });

  // The server rejects the session while the account's first pull runs (a refresh token
  // revoked by a password change, or one that expired while the app sat closed mid-setup): the pull's
  // token refresh gets a 401 and the tokens go (refreshAccessTokenAsync), as at a sign-out. Every loss
  // of the tokens opens the library for the session without them (watchTokenDrops, which
  // LibraryProvider runs from the boot on): this device's library, as the account's hasn't pulled.
  it('a session rejected during the first pull leaves this iPhone’s photos in reach', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const photo = await repo.create(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await signIn(sessionOf('A')); // the setup screen: the merge waits for the first pull
    watching.push(watchTokenDrops(switchLibrary));
    api.post = async () => {
      throw Object.assign(new Error('HTTP 401'), { response: { status: 401 } });
    };
    await expect(refreshAccessTokenAsync({ serverId: 's1', userId: 'A' })).rejects.toThrow('rejected');
    expect(store.session).toMatchObject({ userId: 'A', tokens: null });

    await syncSettled(); // the drop's switch runs in a paused section
    expect(openOwner()).toEqual({ kind: 'device' });
    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);
  });

  // The same rejection, and the user goes on in the library the app shows and adds a photo.
  // That library is this device's from the rejection on, as it is at the next launch: the photo stays
  // in the open library.
  it('a photo added after a session was rejected mid-setup is still there at the next launch', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    await repo.create(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await signIn(sessionOf('A'));
    watching.push(watchTokenDrops(switchLibrary));
    api.post = async () => {
      throw Object.assign(new Error('HTTP 401'), { response: { status: 401 } });
    };
    await expect(refreshAccessTokenAsync({ serverId: 's1', userId: 'A' })).rejects.toThrow('rejected');
    await syncSettled(); // the drop's switch runs in a paused section
    expect(openOwner()).toEqual({ kind: 'device' });
    const added = await repo.create(
      getDb(),
      makeAssetRecord({ filename: 'b.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );

    await closeLibrary(); // the app is closed and opened again
    await bootLibrary(switchLibrary);
    await runPendingMerges();

    expect((await assets()).map(({ id }) => id)).toContain(added.id);
  });

  // A sign-out on the setup screen switches to this device's library (libraryToOpen); when
  // that library's database won't open (a failed migration after an update, a damaged file), the
  // session's own library opens instead (openLibraryForSession), at the sign-out and at every boot,
  // so the app boots and the user can sign in.
  it('a device library that won’t open doesn’t stop the boot after a setup sign-out', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    await repo.create(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    await signIn(sessionOf('A'));
    const aId = getLibrary().id;
    faults.failingOpens.add(`library-${deviceId}.db`);
    await signOut();
    await open(store.session); // what watchTokenDrops runs after the drop
    expect(getLibrary().id).toBe(aId);

    // The app is closed and opened again: the boot's fallback opens the account's library.
    await closeLibrary();
    await bootLibrary(switchLibrary);
    expect(getLibrary().id).toBe(aId);
  });

  // The sign-in's pass committed the device library into A's library and moved the photo's
  // file into A's folders; the device library waits, marked, for A's push (offline, or a row the
  // server keeps rejecting). The user taps "Rebuild from server" (Library sync → Troubleshooting),
  // which clears A's first-sync flag and shows the setup screen again, and signs out there (or the
  // server rejects the session during that pull). libraryToOpen sees A's library "not pulled", but
  // the device library's marker says committed: it has joined A's library, which holds its photo and
  // the photo's file, and A's library stays open. The setup screen counts no photos to add.
  it('a rebuild while a merge waits for its push, then a setup sign-out: the photo shown keeps its file', async () => {
    await loadRegistry(async () => ({ libraries: [] }));
    await open(null);
    const deviceId = getLibrary().id;
    const photo = await repo.create(
      getDb(),
      makeAssetRecord({ filename: 'a.jpg', isFileSynced: false, isThumbnailSynced: false, isSynced: false }),
    );
    files.add(getAssetFileUri('a.jpg', libraryPaths(deviceId)));
    await signIn(sessionOf('A'));
    const aId = getLibrary().id;
    await firstPullDrains(); // the pass commits and moves the file; the push hasn't happened
    expect(files.has(getAssetFileUri('a.jpg', libraryPaths(aId)))).toBe(true);
    expect(getRegistry().libraries.find(({ id }) => id === deviceId)?.mergedInto?.library).toBe(aId);

    const offline = {
      push: async () => Promise.reject(new Error('offline')),
      pull: async () => Promise.reject(new Error('offline')),
    };
    await expect(fullResync(getDb(), offline)).rejects.toThrow('offline'); // Rebuild from server
    await signOut(); // the setup screen's Sign out
    await open(store.session); // what watchTokenDrops runs after the drop

    expect((await assets()).map(({ id }) => id)).toEqual([photo.id]);
    expect(files.has(getAssetFileUri('a.jpg', libraryPaths(getLibrary().id)))).toBe(true);
    expect(deviceLibraryToJoin()).toBeNull();
  });
});
