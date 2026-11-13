import type { AxiosInstance } from 'axios';

import errorResponse from './errorResponse';
import { noteServerStatus } from './updateRequiredStore';

/**
 * Notes every answer `instance` gets in the update gate's store (noteServerStatus): a refusal of this
 * build as too old rejects with an UpdateRequiredError, a success clears the store.
 */
export default function watchUpdateGate(instance: AxiosInstance): void {
  instance.interceptors.response.use(
    (response) => {
      noteServerStatus(response.status);
      return response;
    },
    (error: unknown) => {
      noteServerStatus(errorResponse(error)?.status);
      return Promise.reject(error);
    },
  );
}
