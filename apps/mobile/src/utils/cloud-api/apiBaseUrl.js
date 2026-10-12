import Constants from 'expo-constants';
import { Platform } from 'react-native';

// `npm run dev:local` sets EXPO_PUBLIC_LOCAL_BACKEND and serves the local backend through Metro, so
// the API lives on the dev server the app loaded from: Metro's HTTPS tunnel on a phone, or the page's
// own origin in the web preview.
export const API_BASE_URL = process.env.EXPO_PUBLIC_LOCAL_BACKEND
  ? `${devServerOrigin()}/api/v1`
  : process.env.EXPO_PUBLIC_API_URL;

function devServerOrigin() {
  if (Platform.OS === 'web') return window.location.origin;
  return `https://${Constants.expoConfig.hostUri}`;
}
