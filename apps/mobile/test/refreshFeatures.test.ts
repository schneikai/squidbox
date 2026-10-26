import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionStoreMock } from './helpers/sessionStoreMock';
import type { Session } from '../src/library/session';

const store: { session: Session | null; writes: number } = { session: null, writes: 0 };
const me = vi.fn();
const patch = vi.fn();

vi.mock('../src/utils/cloud-api/sessionStore', () => sessionStoreMock(store));
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({
  API_BASE_URL: 'https://api.test/api/v1',
  SERVER_URL: 'https://api.test',
}));
vi.mock('../src/utils/cloud-api/apiWithAuthentication', () => ({
  default: {
    get: (url: string, config: unknown) => me(url, config),
    patch: (url: string, body: unknown, config: unknown) => patch(url, body, config),
  },
}));

const { default: refreshFeaturesAsync } = await import('../src/utils/cloud-api/refreshFeaturesAsync');
const { default: updateFeatureAsync } = await import('../src/utils/cloud-api/updateFeatureAsync');

const session: Session = {
  serverId: 's1',
  userId: 'u1',
  email: 'a@b.co',
  apiBaseUrl: 'https://api.test/api/v1',
  tokens: { accessToken: 'access', refreshToken: 'refresh' },
};
const answer = (features: string[]) => ({ data: { user: { id: 'u1', email: 'a@b.co', features }, serverId: 's1' } });

describe('refreshFeaturesAsync', () => {
  beforeEach(() => {
    me.mockReset();
    patch.mockReset();
    store.writes = 0;
  });

  it("writes the account's features from /me into the session, for its identity", async () => {
    store.session = session;
    me.mockResolvedValue(answer(['ai', 'ai_admin']));
    await refreshFeaturesAsync();
    expect(me).toHaveBeenCalledWith('me', { identity: { serverId: 's1', userId: 'u1' } });
    expect(store.session).toEqual({ ...session, features: ['ai', 'ai_admin'] });
  });

  it('leaves the session alone when the features are the same', async () => {
    store.session = { ...session, features: ['ai'] };
    me.mockResolvedValue(answer(['ai']));
    await refreshFeaturesAsync();
    expect(store.writes).toBe(0);
  });

  it('takes features away the server took away', async () => {
    store.session = { ...session, features: ['ai', 'ai_admin'] };
    me.mockResolvedValue(answer(['ai']));
    await refreshFeaturesAsync();
    expect(store.session?.features).toEqual(['ai']);
  });

  it("doesn't write into a session that changed meanwhile", async () => {
    store.session = session;
    me.mockImplementation(async () => {
      store.session = { ...session, userId: 'u2' };
      return answer(['ai']);
    });
    await refreshFeaturesAsync();
    expect(store.session).toEqual({ ...session, userId: 'u2' });
  });

  it('rejects without a session with tokens, before asking the server', async () => {
    store.session = { ...session, tokens: null };
    await expect(refreshFeaturesAsync()).rejects.toThrow();
    expect(me).not.toHaveBeenCalled();
  });
});

describe('updateFeatureAsync', () => {
  it('switches the feature on the server, then stores the features it answered with', async () => {
    store.session = { ...session, features: ['ai', 'developer'] };
    patch.mockResolvedValue(answer(['ai', 'ai_admin', 'developer']));
    await updateFeatureAsync('ai_admin', true);
    expect(patch).toHaveBeenCalledWith(
      'me/features',
      { feature: 'ai_admin', isOn: true },
      { identity: { serverId: 's1', userId: 'u1' } },
    );
    expect(store.session?.features).toEqual(['ai', 'ai_admin', 'developer']);
  });

  it('leaves the session as it was when the server says no', async () => {
    store.session = { ...session, features: ['ai'] };
    patch.mockRejectedValue(new Error('403'));
    await expect(updateFeatureAsync('ai_admin', true)).rejects.toThrow('403');
    expect(store.session?.features).toEqual(['ai']);
  });
});
