import { describe, it, expect } from 'vitest';

import getFirstSyncStep from '../src/features/sync-status/getFirstSyncStep';
import { UPDATE_REQUIRED_TEXT } from '../src/utils/cloud-api/updateRequiredText';

type Status = Parameters<typeof getFirstSyncStep>[0];
const idle: Status = { phase: 'idle', lastError: null, updateRequired: false };
const fresh = { wasFailed: false, almostDone: false };
const labelOf = (status: Status, shown = fresh) => getFirstSyncStep(status, shown).label;

describe('getFirstSyncStep', () => {
  it("says Can't reach the server, failed, when a run failed", () => {
    expect(getFirstSyncStep({ ...idle, phase: 'error', lastError: 'offline' }, fresh)).toMatchObject({
      label: "Can't reach the server",
      failed: true,
    });
  });

  it('says to update, failed, when the server refused this build, whatever the run does', () => {
    for (const phase of ['error', 'pulling'] as const)
      expect(
        getFirstSyncStep({ phase, lastError: 'Update required', pullStep: 'downloading', updateRequired: true }, fresh),
      ).toMatchObject({ label: UPDATE_REQUIRED_TEXT, failed: true });
  });

  it('keeps the failure it showed while a retry pushes or pulls without a step, and drops it once a step comes', () => {
    const shownFailed = { ...fresh, wasFailed: true };
    expect(labelOf({ ...idle, phase: 'pushing', lastError: 'offline' }, shownFailed)).toBe("Can't reach the server");
    expect(labelOf({ ...idle, phase: 'pulling', lastError: 'offline' }, shownFailed)).toBe("Can't reach the server");
    expect(
      getFirstSyncStep({ ...idle, phase: 'pulling', lastError: 'offline', pullStep: 'downloading' }, shownFailed),
    ).toMatchObject({ label: 'Downloading your library', failed: false });
  });

  // A launch after the app was closed on the error: the blob still has the last run's error.
  it('does not show an error a run left behind while a new run has not failed', () => {
    expect(getFirstSyncStep({ ...idle, phase: 'pulling', lastError: 'offline' }, fresh)).toMatchObject({
      label: 'Setting up your library',
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
    expect(getFirstSyncStep(finishing, fresh)).toMatchObject({ label: 'Finishing up', step: 'finishing' });
    expect(labelOf(finishing, { ...fresh, almostDone: true })).toBe('Almost done');
  });

  it('ignores a step left over while the phase is not pulling', () => {
    expect(getFirstSyncStep({ ...idle, pullStep: 'finishing' }, { ...fresh, almostDone: true })).toMatchObject({
      label: 'Setting up your library',
      step: undefined,
    });
    expect(labelOf({ ...idle, phase: 'error', lastError: 'boom', pullStep: 'downloading' })).toBe(
      "Can't reach the server",
    );
  });
});
