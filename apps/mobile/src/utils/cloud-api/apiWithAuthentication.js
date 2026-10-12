import axios from 'axios';

import { API_BASE_URL } from './apiBaseUrl';
import { getAccessTokenAsync } from './apiTokenStore';
import refreshAccessTokenAsync from './authentication/refreshAccessTokenAsync';

const apiWithAuthentication = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // fail fast on an unreachable backend instead of hanging (e.g. during startup sync)
});

// Add access token to request headers
apiWithAuthentication.interceptors.request.use(
  async (config) => {
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
      originalRequest._retry = true;
      try {
        const newAccessToken = await refreshAccessTokenAsync();
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return apiWithAuthentication(originalRequest);
      } catch {
        // Refresh failed. Reject with the ORIGINAL 401 so callers see a clean auth failure, not the
        // refresh endpoint's error. A rejected session is reported through sessionExpiry.
      }
    }
    return Promise.reject(error);
  },
);

export default apiWithAuthentication;
