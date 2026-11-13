import { create } from 'axios';

import { API_BASE_URL } from './apiBaseUrl';
import { clientHeader } from './clientHeader';
import watchUpdateGate from './watchUpdateGate';

const api = create({
  baseURL: API_BASE_URL,
  timeout: 15000, // so an unreachable/misconfigured backend fails fast instead of hanging (e.g. init)
});

api.interceptors.request.use((config) => {
  config.headers.set(clientHeader());
  return config;
});
watchUpdateGate(api);

export default api;
