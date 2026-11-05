import Constants from 'expo-constants';
import { Platform } from 'react-native';

// `npm run dev:local` sets EXPO_PUBLIC_LOCAL_BACKEND and serves the local backend through Metro, so
// the API lives on the dev server the app loaded from: Metro's HTTPS tunnel on a phone, or the page's
// own origin in the web preview.
// Read at load, so nothing here throws: the app boots without a URL, as without the env var.
export const API_BASE_URL = process.env.EXPO_PUBLIC_LOCAL_BACKEND
  ? devServerApiUrl()
  : // Every build sets it (.env.local, the EAS profiles); a build without one can't reach a server, and
    // what needs it throws saying so (requireApiBaseUrl).
    process.env.EXPO_PUBLIC_API_URL;

// The server's root, for what lives outside the API prefix (`/up`).
export const SERVER_URL = API_BASE_URL?.replace(/\/api\/v1\/?$/, '');

function devServerApiUrl(): string | undefined {
  if (Platform.OS === 'web') return `${window.location.origin}/api/v1`;
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) {
    console.warn(
      "EXPO_PUBLIC_LOCAL_BACKEND is set but the app wasn't loaded from a dev server (no hostUri): no API URL",
    );
    return undefined;
  }
  return `https://${hostUri}/api/v1`;
}
