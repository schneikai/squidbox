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
  it('says Up to date when nothing waits', () => {
    expect(getLibrarySyncStatusText(idle)).toBe('Up to date');
  });

  it('shows a sync error before syncing and rejected changes', () => {
    expect(getLibrarySyncStatusText({ ...idle, phase: 'pushing', lastError: 'boom', failedCount: 1 })).toBe('Error');
  });

  it('says Syncing… while it pushes or pulls', () => {
    expect(getLibrarySyncStatusText({ ...idle, phase: 'pushing', pendingCount: 3 })).toBe('Syncing…');
    expect(getLibrarySyncStatusText({ ...idle, phase: 'pulling' })).toBe('Syncing…');
  });

  it('shows rejected changes before pending ones', () => {
    expect(getLibrarySyncStatusText({ ...idle, failedCount: 2, pendingCount: 2 })).toBe('2 errors');
    expect(getLibrarySyncStatusText({ ...idle, pendingCount: 3 })).toBe('3 pending');
  });

  it('says what waits for a sign-in once the session ended', () => {
    expect(getLibrarySyncStatusText({ ...idle, needsReauth: true, pendingCount: 12 })).toBe('12 waiting for sign-in');
    expect(getLibrarySyncStatusText({ ...idle, needsReauth: true, lastError: 'Session expired' })).toBe('Up to date');
  });
});
