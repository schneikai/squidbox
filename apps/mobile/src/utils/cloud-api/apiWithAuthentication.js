import axios from 'axios';

import SessionChangedError from './SessionChangedError';
import { API_BASE_URL } from './apiBaseUrl';
import refreshAccessTokenAsync from './authentication/refreshAccessTokenAsync';
import requireSession from './requireSession';
import sessionIdentity from './sessionIdentity';

const apiWithAuthentication = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // fail fast on an unreachable backend instead of hanging (e.g. during startup sync)
});

// Every request reads the access token fresh from the stored session, for the identity it was given
// (`config.identity`) or else for the stored session's, noted on the config so the retry below
// refreshes for the same user.
apiWithAuthentication.interceptors.request.use((config) => {
  const session = requireSession(config.identity);
  if (!config.identity) config.identity = sessionIdentity(session);
  config.headers['Authorization'] = `Bearer ${session.tokens.accessToken}`;
  return config;
});

// Refresh access token if it is expired
apiWithAuthentication.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
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
