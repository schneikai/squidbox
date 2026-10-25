import Constants from 'expo-constants';

// The builds that show test-only UI (Settings → Assistant → Testing): a development bundle (Metro:
// the dev client, the web preview) and the EAS `development` and `preview` builds. An allowlist, so
// production, a release built without EAS and any unknown profile are a release. app.config.js sets
// extra.buildProfile from EAS_BUILD_PROFILE.
const TEST_BUILD_PROFILES = ['development', 'preview'];

export default function isTestBuild() {
  return __DEV__ || TEST_BUILD_PROFILES.includes(Constants.expoConfig?.extra?.buildProfile);
}
