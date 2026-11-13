import { UPDATE_REQUIRED_STATUS } from '@squidbox/shared';

import UpdateRequiredError from './UpdateRequiredError';
import { updateRequiredStore } from './updateRequiredStore';

/**
 * Records a server answer's status in updateRequiredStore: UPDATE_REQUIRED_STATUS sets it and throws
 * an UpdateRequiredError; a success (2xx) clears it, but only from a route the gate covers (`gated`,
 * the API): `/up` answers every build, so its success says nothing about this one. Any other status
 * leaves it.
 */
export default function noteServerStatus(status: number | undefined, gated: boolean): void {
  if (status === UPDATE_REQUIRED_STATUS) {
    updateRequiredStore.set(true);
    throw new UpdateRequiredError();
  }
  if (gated && status !== undefined && status >= 200 && status < 300 && updateRequiredStore.get())
    updateRequiredStore.set(false);
}
