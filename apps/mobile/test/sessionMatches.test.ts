import { describe, it, expect } from 'vitest';

import type { Library } from '../src/library/registry';
import type { Session } from '../src/library/session';
import { isSessionAuthenticated, sessionMatches, syncIdentity } from '../src/library/sessionMatches';

const BASE_URL = 'https://api.test/api/v1';
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
    expect(isSessionAuthenticated(libraryOf('A'), sessionOf('A'), BASE_URL)).toBe(true);
    expect(isSessionAuthenticated(libraryOf('A'), sessionOf('A', { tokens: null }), BASE_URL)).toBe(false);
    expect(isSessionAuthenticated(libraryOf('A'), sessionOf('A', { apiBaseUrl: 'https://old/api/v1' }), BASE_URL)).toBe(
      false,
    );
    expect(isSessionAuthenticated(libraryOf('B'), sessionOf('A'), BASE_URL)).toBe(false);
    expect(isSessionAuthenticated(device, sessionOf('A'), BASE_URL)).toBe(false);
  });
});

describe('syncIdentity', () => {
  it('binds a run to the library and the session', () => {
    expect(syncIdentity(libraryOf('A'), sessionOf('A'), BASE_URL)).toEqual({
      libraryId: 'lib-A',
      serverId: 's1',
      userId: 'A',
    });
  });

  it('is null when nothing may sync: the device library with a stored session, or no usable session', () => {
    expect(syncIdentity(device, sessionOf('A'), BASE_URL)).toBeNull();
    expect(syncIdentity(libraryOf('A'), null, BASE_URL)).toBeNull();
    expect(syncIdentity(libraryOf('A'), sessionOf('A', { tokens: null }), BASE_URL)).toBeNull();
    expect(syncIdentity(libraryOf('A'), sessionOf('B'), BASE_URL)).toBeNull();
  });
});
