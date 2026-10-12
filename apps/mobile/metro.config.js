/* eslint-env node */ // Metro config runs in Node, so __dirname/require are globals here.
// getSentryExpoConfig wraps Expo's default Metro config with Sentry source-map support.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const createLocalBackendProxy = require('./scripts/localBackendProxy');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot);

// --- Monorepo (npm workspaces) support, per Expo's "Work with monorepos" guide. ---
// Watch the whole workspace so changes in packages/* (e.g. @squidbox/shared) hot-reload.
// Append (don't replace) so Expo's default watchFolders are preserved (expo-doctor checks this).
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];
// Resolve modules from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Disable package exports map resolution so Metro uses the react-native/main fields
// instead. Required for src/lib/lucide.js to reach lucide-react-native's CJS subpaths,
// and for @squidbox/shared to resolve via its "main"/"react-native" entry.
config.resolver.unstable_enablePackageExports = false;

// Let Metro treat bundled Drizzle migration files (.sql) as source, so babel-plugin-inline-import
// can inline them (see babel.config.js). Used by the on-device SQLite migrator.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'sql'];

// Dev only: under `npm run dev:local`, Metro also serves the local backend so the phone reaches it
// through Metro's tunnel.
if (process.env.EXPO_PUBLIC_LOCAL_BACKEND) {
  const proxy = createLocalBackendProxy({
    backendUrl: 'http://localhost:3100',
    storageUrl: 'http://localhost:9000',
  });
  const enhanceMiddleware = config.server.enhanceMiddleware;
  config.server.enhanceMiddleware = (middleware, server) => {
    const metroMiddleware = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;
    return (req, res, next) => proxy(req, res, () => metroMiddleware(req, res, next));
  };
}

module.exports = config;
