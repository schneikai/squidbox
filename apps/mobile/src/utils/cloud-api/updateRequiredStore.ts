import createStore from '@/lib/createStore';

/**
 * Whether the server's last answer on a gated route refused this build as too old
 * (docs/sync-design.md §15, The update gate), in memory for the whole app: a build only changes with a
 * restart, so it never outlives one. Written by noteServerStatus, read through hooks/useUpdateRequired.
 */
export const updateRequiredStore = createStore(false);
