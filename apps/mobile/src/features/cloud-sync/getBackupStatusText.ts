import type { CloudSyncValue } from './CloudSyncContext';

import type { readBackupCounts } from '@/sync/assetsRepository';
import formatErrorCount from '@/utils/formatErrorCount';

type BackupStatus = Pick<CloudSyncValue, 'isSyncing' | 'syncMessage' | 'backupError'> &
  Awaited<ReturnType<typeof readBackupCounts>> & { needsReauth?: boolean };

/**
 * The backup's state in a few words, from the cloud-sync context and useBackupCounts: running,
 * failed uploads, a run that couldn't go on (until nothing is left to back up), waiting for a
 * sign-in, behind or done.
 */
export default function getBackupStatusText({
  isSyncing,
  syncMessage,
  backupError,
  syncErrorCount,
  unsyncedCount,
  needsReauth = false,
}: BackupStatus): string {
  if (isSyncing) return syncMessage ?? 'Backing up…';
  if (needsReauth && unsyncedCount > 0) return `${unsyncedCount} waiting for sign-in`;
  if (syncErrorCount > 0) return formatErrorCount(syncErrorCount);
  if (backupError && unsyncedCount > 0) return "Couldn't back up";
  if (unsyncedCount > 0) return `${unsyncedCount} not backed up`;
  return 'All backed up';
}
