import { API_BASE_URL } from './apiBaseUrl';

// The API's base URL for a call that needs it; throws saying so in a build without one.
export default function requireApiBaseUrl(): string {
  if (!API_BASE_URL) throw new Error('This build has no API URL (EXPO_PUBLIC_API_URL)');
  return API_BASE_URL;
}
