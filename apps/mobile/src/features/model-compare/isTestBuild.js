import Constants from 'expo-constants';

// The builds that show test-only UI (Settings → Assistant → Testing): Metro (dev client, web
// preview) and the internal `preview` build. An allowlist, so production and any unknown or unset
// profile are a release. app.config.js sets extra.buildProfile from EAS_BUILD_PROFILE.
const TEST_BUILD_PROFILES = ['development', 'preview'];

export default function isTestBuild() {
  return TEST_BUILD_PROFILES.includes(Constants.expoConfig?.extra?.buildProfile);
}
