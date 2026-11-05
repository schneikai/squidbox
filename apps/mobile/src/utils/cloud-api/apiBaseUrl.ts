import Constants from 'expo-constants';
import { Platform } from 'react-native';

// `npm run dev:local` sets EXPO_PUBLIC_LOCAL_BACKEND and serves the local backend through Metro, so
// the API lives on the dev server the app loaded from: Metro's HTTPS tunnel on a phone, or the page's
// own origin in the web preview.
export const API_BASE_URL = process.env.EXPO_PUBLIC_LOCAL_BACKEND
  ? `${devServerOrigin()}/api/v1`
  : // Every build sets it (.env.local, the EAS profiles); a build without one can't reach a server.
    (process.env.EXPO_PUBLIC_API_URL as string);

// The server's root, for what lives outside the API prefix (`/up`).
export const SERVER_URL = API_BASE_URL?.replace(/\/api\/v1\/?$/, '');

function devServerOrigin(): string {
  if (Platform.OS === 'web') return window.location.origin;
  return `https://${Constants.expoConfig?.hostUri}`;
}
