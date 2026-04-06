// getSentryExpoConfig wraps Expo's default Metro config with Sentry source-map support.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Disable package exports map resolution so Metro uses the react-native/main fields
// instead. Required for src/lib/lucide.js to reach lucide-react-native's CJS subpaths.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
