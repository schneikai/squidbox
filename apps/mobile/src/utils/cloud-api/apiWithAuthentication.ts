import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import SessionChangedError from './SessionChangedError';
import { API_BASE_URL } from './apiBaseUrl';
import { clientHeader } from './clientHeader';
import refreshAccessTokenAsync from './authentication/refreshAccessTokenAsync';
import errorResponse from './errorResponse';
import requireSession from './requireSession';
import sessionIdentity from './sessionIdentity';

import type { SyncIdentity } from '@/library/sessionMatches';

// What a request carries for the interceptors below: the identity it runs for, and whether it is the
// one retry after a refresh.
declare module 'axios' {
  interface AxiosRequestConfig {
    identity?: SyncIdentity;
    _retry?: boolean;
  }
}

const apiWithAuthentication = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // fail fast on an unreachable backend instead of hanging (e.g. during startup sync)
});

// Every request reads the access token fresh from the stored session, for the identity it was given
// (`config.identity`) or else for the stored session's, noted on the config so the retry below
// refreshes for the same user. It names the build too (clientHeader).
apiWithAuthentication.interceptors.request.use((config) => {
  const session = requireSession(config.identity);
  if (!config.identity) config.identity = sessionIdentity(session);
  config.headers.set(clientHeader());
  config.headers['Authorization'] = `Bearer ${session.tokens.accessToken}`;
  return config;
});

// Refresh access token if it is expired
apiWithAuthentication.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: InternalAxiosRequestConfig | undefined = error?.config;
    if (errorResponse(error)?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await refreshAccessTokenAsync(originalRequest.identity);
        return apiWithAuthentication(originalRequest);
      } catch (refreshError) {
        // A session that ended (the server rejected it, which dropped its tokens, or someone else
        // signed in) is the caller's session change, not a failure of its request: the run gate
        // ends a sync or backup run on it. Any other refresh failure rejects with the ORIGINAL 401,
        // so callers see a clean auth failure, not the refresh endpoint's error.
        if (refreshError instanceof SessionChangedError) throw refreshError;
      }
    }
    return Promise.reject(error);
  },
);

export default apiWithAuthentication;
