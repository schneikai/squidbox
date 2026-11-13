import type { CloudContextValue } from '@/providers/cloud/CloudContext';
import type { LiveSyncStatus } from '@/sync/useSyncStatus';
import formatErrorCount from '@/utils/formatErrorCount';

// `updateRequired`: useUpdateRequired.
type LibrarySyncStatus = Pick<LiveSyncStatus, 'phase' | 'lastError' | 'pendingCount' | 'failedCount'> &
  Pick<CloudContextValue, 'needsReauth'> & { updateRequired: boolean };

/**
 * The Library sync row's state in a few words: waiting for a sign-in, waiting for an update the server
 * asks for, failing, syncing, rejected changes, changes waiting to go up, or up to date.
 */
export default function getLibrarySyncStatusText({
  phase,
  lastError,
  pendingCount,
  failedCount,
  needsReauth,
  updateRequired,
}: LibrarySyncStatus): string {
  if (needsReauth) return pendingCount > 0 ? `${pendingCount} waiting for sign-in` : 'Up to date';
  if (updateRequired) return 'Update required';
  if (lastError) return 'Error';
  if (phase === 'pushing' || phase === 'pulling') return 'Syncing…';
  if (failedCount > 0) return formatErrorCount(failedCount);
  if (pendingCount > 0) return `${pendingCount} pending`;
  return 'Up to date';
}
