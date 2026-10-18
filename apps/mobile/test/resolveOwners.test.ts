import { describe, it, expect, vi, beforeEach } from 'vitest';

import { sessionStoreMock } from './helpers/sessionStoreMock';
import { makeTestDb } from './helpers/testDb';
import type { Owner } from '../src/library/owner';
import type { Session } from '../src/library/session';
import type { AppDb } from '../src/sync/db/driver';
import { getOwner, setOwner } from '../src/sync/status';

// The device: its databases by name, the stored session and the library list in AsyncStorage.
const stores = new Map<string, AppDb>();
const storage = new Map<string, string>();
const store: { session: Session | null } = { session: null };
const reported: string[] = [];

vi.mock('../src/sync/db/client', () => ({
  withAppDb: async (name: string, use: (db: AppDb) => Promise<unknown>) => use(stores.get(name)!),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
  },
}));
vi.mock('../src/utils/cloud-api/sessionStore', () => sessionStoreMock(store));
vi.mock('@sentry/react-native', () => ({ captureMessage: (message: string) => reported.push(message) }));

const { resolveOwners } = await import('../src/library/resolveOwners');
const { getRegistry, loadRegistry, updateRegistry } = await import('../src/library/registry');

// A session missing its server or its user, as older builds stored them.
const session = (serverId: string | null, userId: string | null) =>
  ({ serverId, userId, email: 'u1@test', apiBaseUrl: 'https://api.test/api/v1', tokens: null }) as unknown as Session;
// Stored by a build from before every owner had a serverId.
const unresolved = (userId: string, email = '') =>
  ({ kind: 'account', serverId: null, userId, email }) as unknown as Owner;

// Each library's owner, in its database and in the list.
async function libraries(owners: Record<string, Owner>) {
  for (const [id, owner] of Object.entries(owners)) {
    const db = makeTestDb();
    stores.set(id === 'squidbox' ? 'squidbox.db' : `library-${id}.db`, db);
    await setOwner(db, owner);
  }
  await updateRegistry(() => ({ libraries: Object.entries(owners).map(([id, owner]) => ({ id, owner })) }));
}
const listed = (id: string) => getRegistry().libraries.find((library) => library.id === id)!.owner;

describe('resolveOwners', () => {
  beforeEach(async () => {
    stores.clear();
    storage.clear();
    reported.length = 0;
    await loadRegistry(async () => ({ libraries: [] }));
  });

  it("gives the session's user their server, in the database and the list, and keeps a known email", async () => {
    await libraries({ squidbox: unresolved('u1'), abc: unresolved('u1', 'kept@test') });
    store.session = session('s1', 'u1');

    await resolveOwners();

    const resolved = { kind: 'account', serverId: 's1', userId: 'u1', email: 'u1@test' };
    expect(listed('squidbox')).toEqual(resolved);
    expect(await getOwner(stores.get('squidbox.db')!)).toEqual(resolved);
    expect(listed('abc')).toEqual({ ...resolved, email: 'kept@test' });
    expect(reported).toHaveLength(2);
  });

  it('leaves alone another user, a resolved owner and the device library', async () => {
    const owners: Record<string, Owner> = {
      other: unresolved('u2'),
      resolved: { kind: 'account', serverId: 's0', userId: 'u1', email: '' },
      device: { kind: 'device' },
    };
    await libraries(owners);
    store.session = session('s1', 'u1');

    await resolveOwners();

    expect(getRegistry().libraries.map(({ owner }) => owner)).toEqual(Object.values(owners));
    expect(await getOwner(stores.get('library-other.db')!)).toEqual(owners.other);
    expect(reported).toEqual([]);
  });

  it('does nothing until the session knows both its user and its server', async () => {
    await libraries({ squidbox: unresolved('u1') });

    for (const stored of [null, session(null, 'u1'), session('s1', null)]) {
      store.session = stored;
      await resolveOwners();
    }

    expect(listed('squidbox')).toEqual(unresolved('u1'));
    expect(reported).toEqual([]);
  });
});
