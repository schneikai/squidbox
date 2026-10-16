import { AxiosError, AxiosHeaders, type AxiosRequestConfig } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { sessionStoreMock } from './helpers/sessionStoreMock';
import type { Session } from '../src/library/session';

const store: { session: Session | null } = { session: null };
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({ API_BASE_URL: 'https://api.test/api/v1' }));
vi.mock('../src/utils/cloud-api/sessionStore', () => sessionStoreMock(store));
// The refresh checks the identity like the real one and rotates the stored tokens, as the real one
// does after the server answered.
vi.mock('../src/utils/cloud-api/authentication/refreshAccessTokenAsync', async () => {
  const { default: requireSession } = await import('../src/utils/cloud-api/requireSession');
  return {
    default: async (identity?: { serverId: string | null; userId: string }) => {
      requireSession(identity);
      store.session = { ...store.session!, tokens: { accessToken: 'access-2', refreshToken: 'refresh-2' } };
      return 'access-2';
    },
  };
});

const { default: apiWithAuthentication } = await import('../src/utils/cloud-api/apiWithAuthentication');
const { default: SessionChangedError } = await import('../src/utils/cloud-api/SessionChangedError');

const sessionA = (accessToken: string): Session => ({
  serverId: 's1',
  userId: 'A',
  email: 'a@test',
  apiBaseUrl: 'https://api.test/api/v1',
  tokens: { accessToken, refreshToken: 'refresh-1' },
});
const identityA = { serverId: 's1', userId: 'A' };

// A fake network: records the bearer of each request and answers with `status`.
function adapter(statuses: number[]) {
  const bearers: string[] = [];
  const fn = async (config: AxiosRequestConfig) => {
    bearers.push(String(AxiosHeaders.from(config.headers!).get('Authorization')));
    const status = statuses.shift() ?? 200;
    const response = { data: { ok: true }, status, statusText: '', headers: {}, config: config as never };
    if (status >= 400) throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config as never, null, response);
    return response;
  };
  return { fn, bearers };
}

describe('apiWithAuthentication', () => {
  beforeEach(() => {
    store.session = sessionA('access-1');
  });

  it('reads the token fresh for every request, so a mid-run refresh is picked up', async () => {
    const { fn, bearers } = adapter([200, 200]);
    await apiWithAuthentication.post('sync/pull', {}, { identity: identityA, adapter: fn });
    store.session = sessionA('access-rotated');
    await apiWithAuthentication.post('sync/pull', {}, { identity: identityA, adapter: fn });
    expect(bearers).toEqual(['Bearer access-1', 'Bearer access-rotated']);
  });

  it('refreshes once on a 401 and retries with the new token', async () => {
    const { fn, bearers } = adapter([401, 200]);
    const { data } = await apiWithAuthentication.post('sync/push', {}, { identity: identityA, adapter: fn });
    expect(data).toEqual({ ok: true });
    expect(bearers).toEqual(['Bearer access-1', 'Bearer access-2']);
  });

  it('refuses a request for an identity the stored session no longer has', async () => {
    const { fn, bearers } = adapter([200]);
    const identityB = { serverId: 's1', userId: 'B' };
    await expect(apiWithAuthentication.post('sync/pull', {}, { identity: identityB, adapter: fn })).rejects.toThrow(
      SessionChangedError,
    );
    expect(bearers).toEqual([]);
  });

  it('notes the stored session as the identity when the caller gives none', async () => {
    const { fn, bearers } = adapter([200]);
    await apiWithAuthentication.get('me', { adapter: fn });
    expect(bearers).toEqual(['Bearer access-1']);
  });

  it('refreshes for a converted session that does not know its user yet, instead of refusing', async () => {
    store.session = { ...sessionA('access-1'), serverId: null, userId: null, email: null };
    const { fn, bearers } = adapter([401, 200]);
    const { data } = await apiWithAuthentication.get('me', { adapter: fn });
    expect(data).toEqual({ ok: true });
    expect(bearers).toEqual(['Bearer access-1', 'Bearer access-2']);
  });
});
