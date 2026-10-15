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
let getSessionAsync: Store['getSessionAsync'];
let setSessionAsync: Store['setSessionAsync'];

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
  // The store probes the legacy keys once per process, so each test gets a fresh module.
  beforeEach(async () => {
    secure.clear();
    async.clear();
    log.length = 0;
    vi.resetModules();
    ({ getSessionAsync, setSessionAsync } = await import('../src/utils/cloud-api/sessionStore'));
  });

  it('round-trips the session record and deletes it for null', async () => {
    await setSessionAsync(session);
    expect(await getSessionAsync()).toEqual(session);
    await setSessionAsync(null);
    expect(await getSessionAsync()).toBeNull();
  });

  it('converts a legacy install with a stored user, new record first, then the old keys go', async () => {
    legacyInstall();

    const converted = await getSessionAsync();

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
    expect(await getSessionAsync()).toEqual(converted);
  });

  it('converts a legacy install without a stored user: owner fields stay null for /me', async () => {
    legacyInstall({ user: false });

    const converted = await getSessionAsync();

    expect(converted).toMatchObject({ serverId: null, userId: null, email: null });
    expect(converted?.tokens).toEqual({ accessToken: 'old-access', refreshToken: 'old-refresh' });
  });

  it('a legacy install that was signed out converts to no session and drops the stale user', async () => {
    async.set('user', JSON.stringify({ id: 'u1', email: 'a@b.co' }));

    expect(await getSessionAsync()).toBeNull();
    expect(log).not.toContain('set session');
    expect(async.size).toBe(0);
  });

  it('an existing session record wins over legacy keys', async () => {
    await setSessionAsync(session);
    legacyInstall();

    expect(await getSessionAsync()).toEqual(session);
    expect(secure.get('accessToken')).toBe('old-access');
  });
});
