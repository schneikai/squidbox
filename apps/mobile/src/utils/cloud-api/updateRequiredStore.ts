import { UPDATE_REQUIRED_STATUS } from '@squidbox/shared';

import UpdateRequiredError from './UpdateRequiredError';

import createStore from '@/lib/createStore';

/**
 * Whether the server's last answer refused this build as too old (docs/sync-design.md §15, The update
 * gate), in memory for the whole app: a build only changes with a restart, so it never outlives one.
 * Read through hooks/useUpdateRequired.
 */
export const updateRequiredStore = createStore(false);

/**
 * Records a server answer's status: UPDATE_REQUIRED_STATUS sets the store and throws an
 * UpdateRequiredError, a success (2xx) clears it, any other status leaves it.
 */
export function noteServerStatus(status: number | undefined): void {
  if (status === UPDATE_REQUIRED_STATUS) {
    updateRequiredStore.set(true);
    throw new UpdateRequiredError();
  }
  if (status !== undefined && status >= 200 && status < 300 && updateRequiredStore.get())
    updateRequiredStore.set(false);
}
