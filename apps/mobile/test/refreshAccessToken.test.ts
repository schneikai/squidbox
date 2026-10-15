import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Session = {
  serverId: string | null;
  userId: string | null;
  email: string | null;
  apiBaseUrl: string;
  tokens: { accessToken: string; refreshToken: string } | null;
};
const store: { session: Session | null; writes: number } = { session: null, writes: 0 };
const post = vi.fn();

vi.mock('../src/utils/cloud-api/api', () => ({ default: { post: (...args: unknown[]) => post(...args) } }));
vi.mock('../src/utils/cloud-api/sessionStore', () => ({
  getSessionAsync: async () => store.session,
  setSessionAsync: async (session: Session | null) => {
    store.writes += 1;
    store.session = session;
  },
}));

const { default: refreshAccessTokenAsync } =
  await import('../src/utils/cloud-api/authentication/refreshAccessTokenAsync');
const { SessionChangedError } = await import('../src/utils/cloud-api/requireSessionAsync');
const { onSessionExpired } = await import('../src/utils/cloud-api/sessionExpiry');

const sessionA = (tokens: Session['tokens']): Session => ({
  serverId: 's1',
  userId: 'A',
  email: 'a@b.co',
  apiBaseUrl: 'https://api.test/api/v1',
  tokens,
});
const identityA = { serverId: 's1', userId: 'A' };
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
const networkError = () => new Error('Network Error');

describe('refreshAccessTokenAsync', () => {
  let expired: number;
  let unsubscribe: () => void;

  beforeEach(() => {
    store.session = sessionA({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    store.writes = 0;
    post.mockReset();
    expired = 0;
    unsubscribe = onSessionExpired(() => expired++);
  });

  afterEach(() => unsubscribe());

  it('shares one refresh between concurrent callers and writes both tokens once', async () => {
    post.mockResolvedValue({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });

    const results = await Promise.all([refreshAccessTokenAsync(identityA), refreshAccessTokenAsync(identityA)]);

    expect(results).toEqual(['access-2', 'access-2']);
    expect(post).toHaveBeenCalledTimes(1);
    expect(store.writes).toBe(1);
    expect(store.session).toEqual(sessionA({ accessToken: 'access-2', refreshToken: 'refresh-2' }));
  });

  it('drops the tokens and keeps the owner when the server rejects the refresh token', async () => {
    post.mockRejectedValue(httpError(401));

    await expect(refreshAccessTokenAsync(identityA)).rejects.toThrow('HTTP 401');

    expect(store.session).toEqual(sessionA(null));
    expect(expired).toBe(1);
  });

  it('keeps the session on a network error', async () => {
    post.mockRejectedValue(networkError());

    await expect(refreshAccessTokenAsync(identityA)).rejects.toThrow('Network Error');

    expect(store.session).toEqual(sessionA({ accessToken: 'access-1', refreshToken: 'refresh-1' }));
    expect(expired).toBe(0);
  });

  it('keeps a newer session that replaced the rejected one', async () => {
    post.mockImplementation(async () => {
      store.session = sessionA({ accessToken: 'access-new-login', refreshToken: 'refresh-new-login' });
      throw httpError(401);
    });

    await expect(refreshAccessTokenAsync(identityA)).rejects.toThrow('HTTP 401');

    expect(store.session?.tokens).toEqual({ accessToken: 'access-new-login', refreshToken: 'refresh-new-login' });
    expect(expired).toBe(0);
  });

  it('does not write rotated tokens into a session that replaced the refreshed one', async () => {
    const newLogin = { ...sessionA({ accessToken: 'access-B', refreshToken: 'refresh-B' }), userId: 'B' };
    post.mockImplementation(async () => {
      store.session = newLogin;
      return { data: { accessToken: 'access-2', refreshToken: 'refresh-2' } };
    });

    await expect(refreshAccessTokenAsync(identityA)).rejects.toThrow(SessionChangedError);

    expect(store.session).toEqual(newLogin);
  });

  it('refuses to refresh for an identity the stored session no longer has', async () => {
    await expect(refreshAccessTokenAsync({ serverId: 's1', userId: 'B' })).rejects.toThrow(SessionChangedError);

    expect(post).not.toHaveBeenCalled();
    expect(store.session?.tokens?.refreshToken).toBe('refresh-1');
  });

  it('does not call the server without a session', async () => {
    store.session = sessionA(null);

    await expect(refreshAccessTokenAsync(identityA)).rejects.toThrow('Not signed in');

    expect(post).not.toHaveBeenCalled();
    expect(expired).toBe(0);
  });
});
