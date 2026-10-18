import { describe, it, expect, vi, beforeEach } from 'vitest';

import { sessionStoreMock } from './helpers/sessionStoreMock';
import type { Session } from '../src/library/session';

const store: { session: Session | null; writes: number } = { session: null, writes: 0 };
const up = vi.fn();

vi.mock('../src/utils/cloud-api/sessionStore', () => sessionStoreMock(store));
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({
  API_BASE_URL: 'https://new.test/api/v1',
  SERVER_URL: 'https://new.test',
}));
vi.mock('../src/utils/cloud-api/api', () => ({ default: { get: (url: string) => up(url) } }));

const { default: initializeCloudAsync } = await import('../src/utils/cloud-api/initializeCloudAsync');

const tokens = { accessToken: 'access', refreshToken: 'refresh' };
const complete: Session = {
  serverId: 's1',
  userId: 'u1',
  email: 'a@b.co',
  apiBaseUrl: 'https://new.test/api/v1',
  tokens,
};

describe('initializeCloudAsync', () => {
  beforeEach(() => {
    up.mockReset();
    store.writes = 0;
  });

  it('a session from the current base URL is used as it is, without the network', async () => {
    store.session = complete;
    await initializeCloudAsync();
    expect(store.session).toEqual(complete);
    expect(up).not.toHaveBeenCalled();
    expect(store.writes).toBe(0);
  });

  it('no session, or one without tokens, needs no verification', async () => {
    store.session = null;
    await initializeCloudAsync();
    expect(store.session).toBeNull();
    store.session = { ...complete, tokens: null };
    await initializeCloudAsync();
    expect(store.session).toEqual({ ...complete, tokens: null });
    expect(up).not.toHaveBeenCalled();
  });

  it('a changed base URL that reports the same server rebinds the session', async () => {
    store.session = { ...complete, apiBaseUrl: 'https://old.test/api/v1' };
    up.mockResolvedValue({ data: { status: 'ok', serverId: 's1' } });
    await initializeCloudAsync();
    expect(store.session).toEqual(complete);
    expect(up).toHaveBeenCalledWith('https://new.test/up');
  });

  it('a changed base URL that reports another server drops the tokens without rebinding', async () => {
    const elsewhere = { ...complete, apiBaseUrl: 'https://old.test/api/v1' };
    store.session = elsewhere;
    up.mockResolvedValue({ data: { status: 'ok', serverId: 's2' } });
    await initializeCloudAsync();
    expect(store.session).toEqual({ ...elsewhere, tokens: null });
  });

  it('a changed base URL whose server has no identity yet is not trusted', async () => {
    store.session = { ...complete, apiBaseUrl: 'https://old.test/api/v1' };
    up.mockResolvedValue({ data: { status: 'ok' } });
    await initializeCloudAsync();
    expect(store.session?.tokens).toBeNull();
  });

  it('a changed base URL that cannot be reached leaves the session unverified for this launch', async () => {
    const elsewhere = { ...complete, apiBaseUrl: 'https://old.test/api/v1' };
    store.session = elsewhere;
    up.mockRejectedValue(new Error('Network Error'));
    await initializeCloudAsync();
    expect(store.session).toEqual(elsewhere);
  });
});
