import { TurboModuleRegistry } from 'react-native';

// `npm run dev:local` sets EXPO_PUBLIC_LOCAL_BACKEND: Metro then serves the local backend, so the API
// lives on the dev server the bundle came from and the tunnel URL never has to be configured.
export const API_BASE_URL = process.env.EXPO_PUBLIC_LOCAL_BACKEND
  ? `${devServerOrigin()}/api/v1`
  : process.env.EXPO_PUBLIC_API_URL;

function devServerOrigin() {
  const { scriptURL } = TurboModuleRegistry.getEnforcing('SourceCode').getConstants();
  return scriptURL.match(/^https?:\/\/[^/]+/)[0];
}
