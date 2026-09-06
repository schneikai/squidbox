import AsyncStorage from '@react-native-async-storage/async-storage';

// Runtime-selectable API base URL. Defaults to the build-time EXPO_PUBLIC_API_URL, but a dev
// setting can override it at runtime (e.g. point the dev client at your machine's LAN IP or an
// apps/server tunnel) without a rebuild — EXPO_PUBLIC_* is inlined at build time and can't.
const OVERRIDE_KEY = 'apiBaseUrlOverride';

let cached; // undefined = not loaded yet; null = no override

export async function getApiBaseUrlAsync() {
  if (cached === undefined) {
    cached = (await AsyncStorage.getItem(OVERRIDE_KEY)) || null;
  }
  return cached || process.env.EXPO_PUBLIC_API_URL;
}

export async function setApiBaseUrlAsync(url) {
  cached = url || null;
  if (url) await AsyncStorage.setItem(OVERRIDE_KEY, url);
  else await AsyncStorage.removeItem(OVERRIDE_KEY);
}
