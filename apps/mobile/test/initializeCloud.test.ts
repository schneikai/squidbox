import { describe, it, expect, vi, beforeEach } from 'vitest';

import { sessionStoreMock } from './helpers/sessionStoreMock';
import type { Session } from '../src/library/session';

const store: { session: Session | null; writes: number } = { session: null, writes: 0 };
const up = vi.fn();
const me = vi.fn();

vi.mock('../src/utils/cloud-api/sessionStore', () => sessionStoreMock(store));
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({
  API_BASE_URL: 'https://new.test/api/v1',
  SERVER_URL: 'https://new.test',
}));
vi.mock('../src/utils/cloud-api/api', () => ({ default: { get: (url: string) => up(url) } }));
vi.mock('../src/utils/cloud-api/apiWithAuthentication', () => ({ default: { get: (url: string) => me(url) } }));

const { default: initializeCloudAsync } = await import('../src/utils/cloud-api/initializeCloudAsync');

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
    store.writes = 0;
  });

  it('a complete session from the current base URL is used as it is, without the network', async () => {
    store.session = complete;
    expect(await initializeCloudAsync()).toEqual(complete);
    expect(up).not.toHaveBeenCalled();
    expect(me).not.toHaveBeenCalled();
    expect(store.writes).toBe(0);
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

  it('a /me that answers after a refresh rotated the tokens keeps the new tokens', async () => {
    store.session = { ...complete, serverId: null, userId: null, email: null };
    const rotated = { accessToken: 'access-2', refreshToken: 'refresh-2' };
    me.mockImplementation(async () => {
      store.session = { ...store.session!, tokens: rotated };
      return { data: { user: { id: 'u1', email: 'a@b.co' }, serverId: 's1' } };
    });
    expect(await initializeCloudAsync()).toEqual({ ...complete, tokens: rotated });
  });

  it('a network error on /me keeps the session for the next launch', async () => {
    const converted = { ...complete, serverId: null, userId: null, email: null };
    store.session = converted;
    me.mockRejectedValue(new Error('Network Error'));
    expect(await initializeCloudAsync()).toEqual(converted);
    expect(store.writes).toBe(0);
  });

  it('a 401 from /me drops the tokens and keeps the rest', async () => {
    store.session = { ...complete, serverId: null };
    me.mockRejectedValue(httpError(401));
    expect(await initializeCloudAsync()).toEqual({ ...complete, serverId: null, tokens: null });
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

  it('a changed base URL rebinds a session whose server is unresolved and adopts the reported one', async () => {
    store.session = { ...complete, serverId: null, apiBaseUrl: 'https://old.test/api/v1' };
    up.mockResolvedValue({ data: { status: 'ok', serverId: 's1' } });
    expect(await initializeCloudAsync()).toEqual(complete);
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
