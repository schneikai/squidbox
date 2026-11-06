import { describe, it, expect } from 'vitest';

import getLibrarySyncStatusText from '../src/features/sync-status/getLibrarySyncStatusText';

const idle: Parameters<typeof getLibrarySyncStatusText>[0] = {
  phase: 'idle',
  lastError: null,
  pendingCount: 0,
  failedCount: 0,
  needsReauth: false,
};

describe('getLibrarySyncStatusText', () => {
  it('describes the everyday states', () => {
    expect(getLibrarySyncStatusText(idle)).toBe('Up to date');
    expect(getLibrarySyncStatusText({ ...idle, phase: 'error', lastError: 'boom' })).toBe('Error');
    expect(getLibrarySyncStatusText({ ...idle, phase: 'pushing' })).toBe('Syncing…');
    expect(getLibrarySyncStatusText({ ...idle, phase: 'pulling' })).toBe('Syncing…');
    expect(getLibrarySyncStatusText({ ...idle, failedCount: 2, pendingCount: 2 })).toBe('2 errors');
    expect(getLibrarySyncStatusText({ ...idle, pendingCount: 3 })).toBe('3 pending');
  });

  it('says what waits for a sign-in once the session ended', () => {
    expect(getLibrarySyncStatusText({ ...idle, needsReauth: true, pendingCount: 12 })).toBe('12 waiting for sign-in');
    expect(getLibrarySyncStatusText({ ...idle, needsReauth: true, lastError: 'Session expired' })).toBe('Up to date');
  });
});
