import axios from 'axios';

import { getApiBaseUrlAsync } from './apiBaseUrl';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

// Resolve the base URL per-request so a runtime override (dev setting) takes effect.
api.interceptors.request.use(async (config) => {
  config.baseURL = await getApiBaseUrlAsync();
  return config;
});

export default api;
