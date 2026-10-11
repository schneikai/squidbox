import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tokens: { access: string | null; refresh: string | null } = { access: null, refresh: null };
const post = vi.fn();

vi.mock('../src/utils/cloud-api/api', () => ({ default: { post: (...args: unknown[]) => post(...args) } }));
vi.mock('../src/utils/cloud-api/apiTokenStore', () => ({
  getRefreshTokenAsync: async () => tokens.refresh,
  setAccessTokenAsync: async (token: string) => {
    tokens.access = token;
  },
  setRefreshTokenAsync: async (token: string) => {
    tokens.refresh = token;
  },
  clearTokensAsync: async () => {
    tokens.access = null;
    tokens.refresh = null;
  },
}));

const { default: refreshAccessTokenAsync } =
  await import('../src/utils/cloud-api/authentication/refreshAccessTokenAsync');
const { onSessionExpired } = await import('../src/utils/cloud-api/sessionExpiry');

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
const networkError = () => new Error('Network Error');

describe('refreshAccessTokenAsync', () => {
  let expired: number;
  let unsubscribe: () => void;

  beforeEach(() => {
    tokens.access = 'access-1';
    tokens.refresh = 'refresh-1';
    post.mockReset();
    expired = 0;
    unsubscribe = onSessionExpired(() => expired++);
  });

  afterEach(() => unsubscribe());

  it('shares one refresh between concurrent callers (the server rotates refresh tokens)', async () => {
    post.mockResolvedValue({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });

    const results = await Promise.all([refreshAccessTokenAsync(), refreshAccessTokenAsync()]);

    expect(results).toEqual(['access-2', 'access-2']);
    expect(post).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual({ access: 'access-2', refresh: 'refresh-2' });
  });

  it('ends the session when the server rejects the refresh token', async () => {
    post.mockRejectedValue(httpError(401));

    await expect(refreshAccessTokenAsync()).rejects.toThrow('HTTP 401');

    expect(tokens).toEqual({ access: null, refresh: null });
    expect(expired).toBe(1);
  });

  it('keeps the session on a network error', async () => {
    post.mockRejectedValue(networkError());

    await expect(refreshAccessTokenAsync()).rejects.toThrow('Network Error');

    expect(tokens).toEqual({ access: 'access-1', refresh: 'refresh-1' });
    expect(expired).toBe(0);
  });

  it('keeps a newer session that replaced the rejected one', async () => {
    post.mockImplementation(async () => {
      tokens.access = 'access-new-login';
      tokens.refresh = 'refresh-new-login';
      throw httpError(401);
    });

    await expect(refreshAccessTokenAsync()).rejects.toThrow('HTTP 401');

    expect(tokens).toEqual({ access: 'access-new-login', refresh: 'refresh-new-login' });
    expect(expired).toBe(0);
  });

  it('does not call the server without a session', async () => {
    tokens.refresh = null;

    await expect(refreshAccessTokenAsync()).rejects.toThrow('No session to refresh');

    expect(post).not.toHaveBeenCalled();
    expect(expired).toBe(0);
  });
});
