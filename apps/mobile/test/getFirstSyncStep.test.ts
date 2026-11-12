import { describe, it, expect } from 'vitest';

import getFirstSyncStep, { ALMOST_DONE_MS } from '../src/features/sync-status/getFirstSyncStep';

type Status = Parameters<typeof getFirstSyncStep>[0];
const idle: Status = { phase: 'idle', lastError: null };
const labelOf = (status: Status, finishingFor = 0) => getFirstSyncStep(status, finishingFor).label;

describe('getFirstSyncStep', () => {
  it("says Can't reach the server, failed, on an error", () => {
    expect(getFirstSyncStep({ phase: 'error', lastError: 'offline' }, 0)).toEqual({
      label: "Can't reach the server",
      failed: true,
    });
  });

  it('keeps the error while a retry pushes or pulls without a step, and drops it once a step comes', () => {
    expect(labelOf({ phase: 'pushing', lastError: 'offline' })).toBe("Can't reach the server");
    expect(labelOf({ phase: 'pulling', lastError: 'offline' })).toBe("Can't reach the server");
    expect(getFirstSyncStep({ phase: 'pulling', lastError: 'offline', pullStep: 'downloading' }, 0)).toEqual({
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

  it('says Finishing up for the last batch, and Almost done once that has shown for ALMOST_DONE_MS', () => {
    const finishing: Status = { ...idle, phase: 'pulling', pullStep: 'finishing' };
    expect(labelOf(finishing, ALMOST_DONE_MS - 1)).toBe('Finishing up');
    expect(labelOf(finishing, ALMOST_DONE_MS)).toBe('Almost done');
  });

  it('ignores a step left over while the phase is not pulling', () => {
    expect(labelOf({ phase: 'idle', lastError: null, pullStep: 'finishing' }, ALMOST_DONE_MS)).toBe(
      'Setting up your library',
    );
    expect(labelOf({ phase: 'error', lastError: 'boom', pullStep: 'downloading' })).toBe("Can't reach the server");
  });
});
