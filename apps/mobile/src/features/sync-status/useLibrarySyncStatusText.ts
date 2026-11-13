import getLibrarySyncStatusText from '@/features/sync-status/getLibrarySyncStatusText';
import useUpdateRequired from '@/hooks/useUpdateRequired';
import useCloud from '@/providers/cloud/useCloud';
import type { LiveSyncStatus } from '@/sync/useSyncStatus';

/** The Library sync row's text (getLibrarySyncStatusText) for the screen's `status` (useSyncStatus). */
export default function useLibrarySyncStatusText(status: LiveSyncStatus): string {
  const { needsReauth } = useCloud();
  const updateRequired = useUpdateRequired();
  return getLibrarySyncStatusText({ ...status, needsReauth, updateRequired });
}
