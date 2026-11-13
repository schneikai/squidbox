import { describe, it, expect } from 'vitest';

import getLibrarySyncStatusText from '../src/features/sync-status/getLibrarySyncStatusText';

const idle: Parameters<typeof getLibrarySyncStatusText>[0] = {
  phase: 'idle',
  lastError: null,
  pendingCount: 0,
  failedCount: 0,
  needsReauth: false,
  updateRequired: false,
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
  });

  it('counts the changes waiting to go up', () => {
    expect(getLibrarySyncStatusText({ ...idle, pendingCount: 3 })).toBe('3 pending');
  });

  it('counts what waits for a sign-in once the session ended', () => {
    expect(getLibrarySyncStatusText({ ...idle, needsReauth: true, pendingCount: 12 })).toBe('12 waiting for sign-in');
  });

  it('says Update required when the server refused this build, before an error', () => {
    expect(getLibrarySyncStatusText({ ...idle, phase: 'error', lastError: 'boom', updateRequired: true })).toBe(
      'Update required',
    );
  });

  it('counts what waits for a sign-in before an update the server asks for', () => {
    expect(getLibrarySyncStatusText({ ...idle, needsReauth: true, updateRequired: true, pendingCount: 2 })).toBe(
      '2 waiting for sign-in',
    );
  });

  it('says Up to date once the session ended with nothing waiting, even after an error', () => {
    expect(getLibrarySyncStatusText({ ...idle, needsReauth: true, lastError: 'Session expired' })).toBe('Up to date');
  });
});
