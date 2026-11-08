const { execSync } = require('node:child_process');

// The commit this build is made from, which every request names (src/utils/cloud-api/clientHeader.ts).
// EAS uploads no .git and sets EAS_BUILD_GIT_COMMIT_HASH instead; Metro and local builds run in the
// checkout. A build that can't name its commit fails here.
function gitCommit() {
  if (process.env.EAS_BUILD_GIT_COMMIT_HASH) return process.env.EAS_BUILD_GIT_COMMIT_HASH;
  try {
    return execSync('git rev-parse HEAD', { cwd: __dirname, encoding: 'utf8' }).trim();
  } catch (error) {
    throw new Error(`app.config.js: the build must know its git commit (${error.message})`);
  }
}

// Matched by colors.background.splash, for BootScreen, which takes over from the splash.
const SPLASH_BACKGROUND = '#B1F1FF';

const baseConfig = {
  expo: {
    name: 'Squidbox',
    slug: 'squidbox',
    version: '0.0.1',
    // Bump whenever native modules change, so an OTA bundle is never delivered to a binary that
    // lacks a module it needs.
    runtimeVersion: '1.1.0',
    orientation: 'portrait',
    // Deep links (squidbox://post/…) open the screen at that URL (Expo Router).
    scheme: 'squidbox',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: SPLASH_BACKGROUND,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.schneikai.squidbox',
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: SPLASH_BACKGROUND,
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      // Which EAS build this is (EAS sets EAS_BUILD_PROFILE); unset for any other build, which
      // counts as a release. src/utils/isTestBuild.ts reads it.
      buildProfile: process.env.EAS_BUILD_PROFILE,
      gitCommit: gitCommit(),
      eas: {
        projectId: 'e74016a5-b902-4dca-9c35-f1ef376c4f52',
      },
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-sqlite',
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: 'squidbox-app',
          organization: 'squidbox',
        },
      ],
      '@sentry/react-native',
      'expo-image',
      'expo-video',
    ],
  },
};

// Use a separate app slot for the dev client so it doesn't overwrite the
// preview/production build on the device. EAS passes the profile via the
// EAS_BUILD_PROFILE env var when evaluating this config during a build.
if (process.env.EAS_BUILD_PROFILE === 'development') {
  baseConfig.expo.name = 'Squidbox (Dev)';
  baseConfig.expo.icon = './assets/icon-dev.png';
  // Its own scheme, so a squidbox:// link opens the release app when both are installed.
  baseConfig.expo.scheme = 'squidbox-dev';
  baseConfig.expo.ios = {
    ...baseConfig.expo.ios,
    bundleIdentifier: 'com.schneikai.squidbox.dev',
  };
}

module.exports = baseConfig;
