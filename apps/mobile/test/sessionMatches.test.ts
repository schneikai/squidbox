import { describe, it, expect, vi } from 'vitest';

import type { Library } from '../src/library/registry';
import type { Session } from '../src/library/session';

const BASE_URL = 'https://api.test/api/v1';
vi.mock('../src/utils/cloud-api/apiBaseUrl', () => ({ API_BASE_URL: BASE_URL }));
const { isSessionAuthenticated, sessionMatches } = await import('../src/library/sessionMatches');

const tokens = { accessToken: 'a', refreshToken: 'r' };
const device: Library = { id: 'dev', owner: { kind: 'device' } };
const libraryOf = (userId: string, serverId: string | null = 's1'): Library => ({
  id: `lib-${userId}`,
  owner: { kind: 'account', serverId, userId, email: `${userId}@test` },
});
const sessionOf = (userId: string | null, over: Partial<Session> = {}): Session => ({
  serverId: 's1',
  userId,
  email: userId && `${userId}@test`,
  apiBaseUrl: BASE_URL,
  tokens,
  ...over,
});

describe('sessionMatches', () => {
  it('is the library owner', () => {
    expect(sessionMatches(libraryOf('A'), sessionOf('A'))).toBe(true);
    expect(sessionMatches(libraryOf('A'), sessionOf('B'))).toBe(false);
    expect(sessionMatches(libraryOf('A'), sessionOf('A', { serverId: 's2' }))).toBe(false);
  });

  it('never matches the device library, no session, or a session without a user', () => {
    expect(sessionMatches(device, sessionOf('A'))).toBe(false);
    expect(sessionMatches(libraryOf('A'), null)).toBe(false);
    expect(sessionMatches(libraryOf('A'), sessionOf(null))).toBe(false);
  });

  it('treats an unresolved serverId on either side as the same server', () => {
    expect(sessionMatches(libraryOf('A', null), sessionOf('A'))).toBe(true);
    expect(sessionMatches(libraryOf('A'), sessionOf('A', { serverId: null }))).toBe(true);
    expect(sessionMatches(libraryOf('A', null), sessionOf('A', { serverId: null }))).toBe(true);
  });
});

describe('isSessionAuthenticated', () => {
  it('needs tokens, the current base URL and the owner', () => {
    expect(isSessionAuthenticated(libraryOf('A'), sessionOf('A'))).toBe(true);
    expect(isSessionAuthenticated(libraryOf('A'), sessionOf('A', { tokens: null }))).toBe(false);
    expect(isSessionAuthenticated(libraryOf('A'), sessionOf('A', { apiBaseUrl: 'https://old/api/v1' }))).toBe(false);
    expect(isSessionAuthenticated(libraryOf('B'), sessionOf('A'))).toBe(false);
    expect(isSessionAuthenticated(device, sessionOf('A'))).toBe(false);
    expect(isSessionAuthenticated(libraryOf('A'), null)).toBe(false);
  });
});
