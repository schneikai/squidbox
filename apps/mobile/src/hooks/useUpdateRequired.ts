import { useSyncExternalStore } from 'react';

import useCloud from '@/providers/cloud/useCloud';
import { updateRequiredStore } from '@/utils/cloud-api/updateRequiredStore';

/**
 * Whether the server refused this build as too old on its last answer (docs/sync-design.md §15, The
 * update gate), while signed in: the one source every surface of the gate reads.
 */
export default function useUpdateRequired(): boolean {
  const { isAuthenticated } = useCloud();
  const updateRequired = useSyncExternalStore(updateRequiredStore.subscribe, updateRequiredStore.get);
  return isAuthenticated && updateRequired;
}
