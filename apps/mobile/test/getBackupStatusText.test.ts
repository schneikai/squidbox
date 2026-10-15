import { describe, it, expect } from 'vitest';

import getBackupStatusText from '../src/features/cloud-sync/getBackupStatusText';

const idle = { isSyncing: false, syncMessage: null, backupError: null, syncErrorCount: 0, unsyncedCount: 0 };

describe('getBackupStatusText', () => {
  it('describes the everyday states', () => {
    expect(getBackupStatusText(idle)).toBe('All backed up');
    expect(getBackupStatusText({ ...idle, unsyncedCount: 3 })).toBe('3 not backed up');
    expect(getBackupStatusText({ ...idle, isSyncing: true, syncMessage: 'Syncing 1 of 3' })).toBe('Syncing 1 of 3');
    expect(getBackupStatusText({ ...idle, syncErrorCount: 2, unsyncedCount: 2 })).toBe('2 errors');
    expect(getBackupStatusText({ ...idle, backupError: 'boom', unsyncedCount: 1 })).toBe("Couldn't back up");
  });

  it('says what waits for a sign-in once the session ended', () => {
    expect(getBackupStatusText({ ...idle, unsyncedCount: 12, needsReauth: true })).toBe('12 waiting for sign-in');
    expect(getBackupStatusText({ ...idle, syncErrorCount: 1, unsyncedCount: 1, needsReauth: true })).toBe(
      '1 waiting for sign-in',
    );
    expect(getBackupStatusText({ ...idle, needsReauth: true })).toBe('All backed up');
  });
});
