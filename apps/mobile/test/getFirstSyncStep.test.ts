import { describe, it, expect } from 'vitest';

import getFirstSyncStep from '../src/features/sync-status/getFirstSyncStep';

type Status = Parameters<typeof getFirstSyncStep>[0];
const idle: Status = { phase: 'idle', lastError: null };
const labelOf = (status: Status, almostDone = false) => getFirstSyncStep(status, almostDone).label;

describe('getFirstSyncStep', () => {
  it("says Can't reach the server, failed, on an error", () => {
    expect(getFirstSyncStep({ phase: 'error', lastError: 'offline' }, false)).toEqual({
      label: "Can't reach the server",
      failed: true,
    });
  });

  it('keeps the error while a retry pushes or pulls without a step, and drops it once a step comes', () => {
    expect(labelOf({ phase: 'pushing', lastError: 'offline' })).toBe("Can't reach the server");
    expect(labelOf({ phase: 'pulling', lastError: 'offline' })).toBe("Can't reach the server");
    expect(getFirstSyncStep({ phase: 'pulling', lastError: 'offline', pullStep: 'downloading' }, false)).toEqual({
      label: 'Downloading your library',
      failed: false,
    });
  });

  it('says Setting up your library before any batch arrived', () => {
    expect(labelOf(idle)).toBe('Setting up your library');
    expect(labelOf({ ...idle, phase: 'pushing' })).toBe('Setting up your library');
    expect(labelOf({ ...idle, phase: 'pulling' })).toBe('Setting up your library');
  });

  it('says Downloading your library while batches arrive', () => {
    expect(labelOf({ ...idle, phase: 'pulling', pullStep: 'downloading' })).toBe('Downloading your library');
  });

  it('says Finishing up for the last batch, and Almost done once that has shown a while', () => {
    const finishing: Status = { ...idle, phase: 'pulling', pullStep: 'finishing' };
    expect(labelOf(finishing)).toBe('Finishing up');
    expect(labelOf(finishing, true)).toBe('Almost done');
  });

  it('ignores a step left over while the phase is not pulling', () => {
    expect(labelOf({ phase: 'idle', lastError: null, pullStep: 'finishing' }, true)).toBe('Setting up your library');
    expect(labelOf({ phase: 'error', lastError: 'boom', pullStep: 'downloading' })).toBe("Can't reach the server");
  });
});
