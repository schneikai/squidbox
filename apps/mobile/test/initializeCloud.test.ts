import { describe, it, expect, vi, beforeEach } from 'vitest';

type Session = {
  serverId: string | null;
  userId: string | null;
  email: string | null;
  apiBaseUrl: string;
  tokens: { accessToken: string; refreshToken: string } | null;
};
const store: { session: Session | null } = { session: null };
const up = vi.fn();
const me = vi.fn();

vi.mock('../src/utils/cloud-api/sessionStore', () => ({
  getSessionAsync: async () => store.session,
  setSessionAsync: async (session: Session | null) => {
    store.session = session;
  },
}));
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({
  API_BASE_URL: 'https://new.test/api/v1',
  SERVER_URL: 'https://new.test',
}));
vi.mock('../src/utils/cloud-api/api', () => ({ default: { get: (url: string) => up(url) } }));
vi.mock('../src/utils/cloud-api/apiWithAuthentication', () => ({ default: { get: (url: string) => me(url) } }));

const { default: initializeCloudAsync } = await import('../src/features/cloud/initializeCloudAsync');

const tokens = { accessToken: 'access', refreshToken: 'refresh' };
const complete: Session = {
  serverId: 's1',
  userId: 'u1',
  email: 'a@b.co',
  apiBaseUrl: 'https://new.test/api/v1',
  tokens,
};
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

describe('initializeCloudAsync', () => {
  beforeEach(() => {
    up.mockReset();
    me.mockReset();
  });

  it('a complete session from the current base URL is used as it is, without the network', async () => {
    store.session = complete;
    expect(await initializeCloudAsync()).toEqual(complete);
    expect(up).not.toHaveBeenCalled();
    expect(me).not.toHaveBeenCalled();
  });

  it('no session, or one without tokens, needs no verification', async () => {
    store.session = null;
    expect(await initializeCloudAsync()).toBeNull();
    store.session = { ...complete, tokens: null };
    expect(await initializeCloudAsync()).toEqual({ ...complete, tokens: null });
    expect(up).not.toHaveBeenCalled();
  });

  it('fills a converted session from /me', async () => {
    store.session = { ...complete, serverId: null, userId: null, email: null };
    me.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.co' }, serverId: 's1' } });

    expect(await initializeCloudAsync()).toEqual(complete);
    expect(store.session).toEqual(complete);
    expect(me).toHaveBeenCalledWith('me');
  });

  it('a network error on /me keeps the session for the next launch', async () => {
    const converted = { ...complete, serverId: null, userId: null, email: null };
    store.session = converted;
    me.mockRejectedValue(new Error('Network Error'));

    expect(await initializeCloudAsync()).toEqual(converted);
    expect(store.session).toEqual(converted);
  });

  it('a 401 from /me drops the tokens and keeps the rest', async () => {
    store.session = { ...complete, serverId: null };
    me.mockRejectedValue(httpError(401));

    expect(await initializeCloudAsync()).toEqual({ ...complete, serverId: null, tokens: null });
    expect(store.session?.tokens).toBeNull();
  });

  it('a changed base URL that reports the same server rebinds the session', async () => {
    store.session = { ...complete, apiBaseUrl: 'https://old.test/api/v1' };
    up.mockResolvedValue({ data: { status: 'ok', serverId: 's1' } });

    expect(await initializeCloudAsync()).toEqual(complete);
    expect(up).toHaveBeenCalledWith('https://new.test/up');
    expect(me).not.toHaveBeenCalled();
  });

  it('a changed base URL that reports another server drops the tokens without rebinding', async () => {
    const elsewhere = { ...complete, apiBaseUrl: 'https://old.test/api/v1' };
    store.session = elsewhere;
    up.mockResolvedValue({ data: { status: 'ok', serverId: 's2' } });

    expect(await initializeCloudAsync()).toEqual({ ...elsewhere, tokens: null });
    expect(me).not.toHaveBeenCalled();
  });

  it('a changed base URL whose server has no identity yet is not trusted', async () => {
    store.session = { ...complete, serverId: null, apiBaseUrl: 'https://old.test/api/v1' };
    up.mockResolvedValue({ data: { status: 'ok' } });

    expect((await initializeCloudAsync())?.tokens).toBeNull();
  });

  it('a changed base URL that cannot be reached leaves the session unverified for this launch', async () => {
    const elsewhere = { ...complete, apiBaseUrl: 'https://old.test/api/v1' };
    store.session = elsewhere;
    up.mockRejectedValue(new Error('Network Error'));

    expect(await initializeCloudAsync()).toEqual(elsewhere);
  });
});
