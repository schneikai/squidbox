import axios from 'axios';

import { API_BASE_URL } from './apiBaseUrl';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // so an unreachable/misconfigured backend fails fast instead of hanging (e.g. init)
});

export default api;
