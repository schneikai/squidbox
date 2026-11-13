import useCloud from '@/providers/cloud/useCloud';
import { useStoredUpdateRequired } from '@/sync/useSyncStatus';

/**
 * Whether the server refused this build as too old on the last sync (docs/sync-design.md §15, The
 * update gate), while signed in: what every surface of the gate reads. Edits wait in the outbox.
 */
export default function useUpdateRequired(): boolean {
  const { isAuthenticated } = useCloud();
  const stored = useStoredUpdateRequired();
  return isAuthenticated && stored;
}
