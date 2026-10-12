import Constants from 'expo-constants';

// `npm run dev:local` sets EXPO_PUBLIC_LOCAL_BACKEND and serves the local backend through Metro's
// HTTPS tunnel, so the API lives on the dev server host the app loaded from.
export const API_BASE_URL = process.env.EXPO_PUBLIC_LOCAL_BACKEND
  ? `https://${Constants.expoConfig.hostUri}/api/v1`
  : process.env.EXPO_PUBLIC_API_URL;
