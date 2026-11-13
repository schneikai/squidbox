import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import noteServerStatus from './noteServerStatus';

// The routes the server's update gate covers: everything under /api (not /up).
const GATED_PATH = /^(?:[a-z][a-z\d+.-]*:\/\/[^/]+)?\/api\//i;

/**
 * Notes every answer `instance` gets in the update gate's store (noteServerStatus): a refusal of this
 * build as too old rejects with an UpdateRequiredError, a success on a gated route clears the store.
 */
export default function watchUpdateGate(instance: AxiosInstance): void {
  const gated = (config: InternalAxiosRequestConfig | undefined) =>
    config !== undefined && GATED_PATH.test(instance.getUri(config));
  instance.interceptors.response.use(
    (response) => {
      noteServerStatus(response.status, gated(response.config));
      return response;
    },
    (error: unknown) => {
      const response = (error as { response?: { status?: number; config?: InternalAxiosRequestConfig } } | null)
        ?.response;
      noteServerStatus(response?.status, gated(response?.config));
      return Promise.reject(error);
    },
  );
}
