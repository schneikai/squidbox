import { describe, it, expect, vi, beforeEach } from 'vitest';

// The two thin stores, in memory, with a log of every write in order.
const secure = new Map<string, string>();
const async = new Map<string, string>();
const log: string[] = [];

vi.mock('../src/utils/cloud-api/secureStorage', () => ({
  getItemAsync: async (key: string) => secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    log.push(`set ${key}`);
    secure.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    log.push(`delete ${key}`);
    secure.delete(key);
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => async.get(key) ?? null,
    removeItem: async (key: string) => {
      log.push(`remove ${key}`);
      async.delete(key);
    },
  },
}));
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({ API_BASE_URL: 'https://api.test/api/v1' }));

type Store = typeof import('../src/utils/cloud-api/sessionStore');
let store: Store;

const session = {
  serverId: 's1',
  userId: 'u1',
  email: 'a@b.co',
  apiBaseUrl: 'https://api.test/api/v1',
  tokens: { accessToken: 'access', refreshToken: 'refresh' },
};

function legacyInstall({ user = true } = {}) {
  secure.set('accessToken', 'old-access');
  secure.set('refreshToken', 'old-refresh');
  if (user) async.set('user', JSON.stringify({ id: 'u1', email: 'a@b.co' }));
}

describe('sessionStore', () => {
  // One in-memory copy per process: each test gets a fresh module.
  beforeEach(async () => {
    secure.clear();
    async.clear();
    log.length = 0;
    vi.resetModules();
    store = await import('../src/utils/cloud-api/sessionStore');
  });

  it('is unavailable before the boot loaded it', () => {
    expect(() => store.getSession()).toThrow('not loaded');
  });

  it('loads the stored record, changes it through updateSession and writes through', async () => {
    secure.set('session', JSON.stringify(session));
    expect(await store.loadSessionAsync()).toEqual(session);
    expect(store.getSession()).toEqual(session);

    const seen: unknown[] = [];
    store.onSessionChange((next) => seen.push(next));
    await store.updateSession((current) => ({ ...current!, tokens: null }));
    expect(store.getSession()).toEqual({ ...session, tokens: null });
    expect(JSON.parse(secure.get('session')!)).toEqual({ ...session, tokens: null });
    await store.updateSession(() => null);
    expect(store.getSession()).toBeNull();
    expect(secure.has('session')).toBe(false);
    expect(seen).toEqual([{ ...session, tokens: null }, null]);
  });

  it('dropTokensAsync keeps the owner and resolves the dropped tokens, once', async () => {
    secure.set('session', JSON.stringify(session));
    await store.loadSessionAsync();
    expect(await store.dropTokensAsync()).toEqual(session.tokens);
    expect(store.getSession()).toEqual({ ...session, tokens: null });
    expect(JSON.parse(secure.get('session')!)).toEqual({ ...session, tokens: null });
    log.length = 0;
    expect(await store.dropTokensAsync()).toBeNull();
    expect(log).toEqual([]);
  });

  it('writes nothing when the change returns the same record', async () => {
    secure.set('session', JSON.stringify(session));
    await store.loadSessionAsync();
    log.length = 0;
    await store.updateSession((current) => current);
    expect(log).toEqual([]);
  });

  it('serializes concurrent updates so none is lost', async () => {
    secure.set('session', JSON.stringify(session));
    await store.loadSessionAsync();
    await Promise.all([
      store.updateSession((current) => ({ ...current!, email: 'one' })),
      store.updateSession((current) => ({ ...current!, serverId: 'two' })),
    ]);
    expect(store.getSession()).toMatchObject({ email: 'one', serverId: 'two' });
    expect(JSON.parse(secure.get('session')!)).toMatchObject({ email: 'one', serverId: 'two' });
  });

  it('a fresh install has no session and nothing is deleted', async () => {
    expect(await store.loadSessionAsync()).toBeNull();
    expect(log).toEqual([]);
  });

  it('converts a legacy install with a stored user, new record first, then the old keys go', async () => {
    legacyInstall();

    const converted = await store.loadSessionAsync();

    expect(converted).toEqual({
      serverId: null,
      userId: 'u1',
      email: 'a@b.co',
      apiBaseUrl: 'https://api.test/api/v1',
      tokens: { accessToken: 'old-access', refreshToken: 'old-refresh' },
    });
    expect(log[0]).toBe('set session');
    expect(log.slice(1).sort()).toEqual(['delete accessToken', 'delete refreshToken', 'remove user']);
    expect([...secure.keys()]).toEqual(['session']);
    expect(async.size).toBe(0);
  });

  it('converts a legacy install without a stored user: owner fields stay null for /me', async () => {
    legacyInstall({ user: false });
    const converted = await store.loadSessionAsync();
    expect(converted).toMatchObject({ serverId: null, userId: null, email: null });
    expect(converted?.tokens).toEqual({ accessToken: 'old-access', refreshToken: 'old-refresh' });
  });

  it('a legacy install that was signed out converts to no session and touches nothing', async () => {
    async.set('user', JSON.stringify({ id: 'u1', email: 'a@b.co' }));
    expect(await store.loadSessionAsync()).toBeNull();
    expect(log).toEqual([]);
    expect(async.has('user')).toBe(true);
  });

  it('an existing session record wins over legacy keys', async () => {
    secure.set('session', JSON.stringify(session));
    legacyInstall();
    expect(await store.loadSessionAsync()).toEqual(session);
    expect(secure.get('accessToken')).toBe('old-access');
  });
});
