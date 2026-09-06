import axios from 'axios';

import { getAccessTokenAsync, getRefreshTokenAsync } from './apiTokenStore';
import refreshAccessTokenAsync from './authentication/refreshAccessTokenAsync';

const apiWithAuthentication = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
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
    if (error?.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = await getRefreshTokenAsync();
      const newAccessToken = await refreshAccessTokenAsync(refreshToken);
      if (newAccessToken) {
        originalRequest._retry = true;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return apiWithAuthentication(originalRequest);
      }
    }
    return Promise.reject(error);
  },
);

export default apiWithAuthentication;
