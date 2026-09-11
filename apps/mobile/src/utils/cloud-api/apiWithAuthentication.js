import axios from 'axios';

import { getApiBaseUrlAsync } from './apiBaseUrl';
import { getAccessTokenAsync, getRefreshTokenAsync } from './apiTokenStore';
import refreshAccessTokenAsync from './authentication/refreshAccessTokenAsync';

const apiWithAuthentication = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

// Add access token to request headers (+ resolve the runtime base URL)
apiWithAuthentication.interceptors.request.use(
  async (config) => {
    config.baseURL = await getApiBaseUrlAsync();
    if (!config.headers['Authorization']) {
      const accessToken = await getAccessTokenAsync();
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Refresh access token if it is expired
apiWithAuthentication.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
      try {
        const refreshToken = await getRefreshTokenAsync();
        const newAccessToken = await refreshAccessTokenAsync(refreshToken);
        if (newAccessToken) {
          originalRequest._retry = true;
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          return apiWithAuthentication(originalRequest);
        }
      } catch {
        // Refresh failed (e.g. a stale/incompatible session). refreshAccessTokenAsync already
        // cleared the tokens; swallow the refresh error and reject with the ORIGINAL 401 so callers
        // see a clean auth failure — not the refresh endpoint's confusing 400.
      }
    }
    return Promise.reject(error);
  },
);

export default apiWithAuthentication;
