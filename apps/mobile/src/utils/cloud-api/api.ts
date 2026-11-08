import axios from 'axios';

import { API_BASE_URL } from './apiBaseUrl';
import { clientHeader } from './clientHeader';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // so an unreachable/misconfigured backend fails fast instead of hanging (e.g. init)
});

api.interceptors.request.use((config) => {
  config.headers.set(clientHeader());
  return config;
});

export default api;
