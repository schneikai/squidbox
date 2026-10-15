import pluralizeText from '@/utils/pluralizeText';

/** The backup's state in a few words, from the cloud-sync context: running, failed, behind or done. */
export default function getBackupStatusText({ isSyncing, syncMessage, backupError, syncErrorCount, unsyncedCount }) {
  if (isSyncing) return syncMessage ?? 'Backing up…';
  if (backupError) return "Couldn't back up";
  if (syncErrorCount > 0) return pluralizeText('1 error', '%{count} errors', syncErrorCount);
  if (unsyncedCount > 0) return `${unsyncedCount} not backed up`;
  return 'All backed up';
}
