const { execSync } = require('node:child_process');

// The commit this build is made from, which every request names (src/utils/cloud-api/clientHeader.ts).
// EAS uploads no .git and sets EAS_BUILD_GIT_COMMIT_HASH instead; Metro and local builds run in the
// checkout. A build that can't name its commit fails here.
function gitCommit() {
  if (process.env.EAS_BUILD_GIT_COMMIT_HASH) return process.env.EAS_BUILD_GIT_COMMIT_HASH;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    throw new Error(`app.config.js: the build must know its git commit (${error.message})`);
  }
}

// An App build or update must have its contract snapshot pushed before it ships, so no installed
// code goes unchecked (docs/sync-design.md §15): `npm run ios:app` and `npm run ios:update` write
// and push it first. The marker SQUIDBOX_APP_BUILD comes from eas.json (builds), from that script
// (updates), and from the preview and production EAS environments (any `eas update --environment
// <profile>`). Checked where eas-cli starts the build or the update, not on the EAS worker. A
// re-sign or a credentials repair of an earlier build sets SQUIDBOX_NOT_A_BUILD=1.
function requirePushedSnapshot(commit) {
  const { SQUIDBOX_APP_BUILD, SQUIDBOX_NOT_A_BUILD, EAS_BUILD } = process.env;
  if (!SQUIDBOX_APP_BUILD || SQUIDBOX_NOT_A_BUILD || EAS_BUILD) return;
  // eas-cli uploads the working tree: changes there would ship code the snapshot doesn't describe.
  if (execSync('git status --porcelain', { encoding: 'utf8' }).trim()) {
    throw new Error(
      'app.config.js: an App build or update needs a clean checkout. Ship it with `npm run ios:app` or `npm run ios:update`.',
    );
  }
  // The snapshot's name, as snapshotFile (apps/server/src/contract/snapshots.ts) writes it.
  const snapshot = `:(top,glob)apps/server/contract/builds/*-${commit.slice(0, 8)}.json`;
  const pushed = execSync(`git log --remotes -1 --format=%H -- "${snapshot}"`, { encoding: 'utf8' }).trim();
  if (!pushed) {
    throw new Error(
      `app.config.js: no pushed contract snapshot of ${commit.slice(0, 8)}. Ship the App with \`npm run ios:app\` (a build) or \`npm run ios:update\` (an update), which push it first (ios-build skill).`,
    );
  }
}

// The EAS project: the builds' project and the server updates are fetched from.
const EAS_PROJECT_ID = 'e74016a5-b902-4dca-9c35-f1ef376c4f52';

// Matched by colors.background.splash, for BootScreen, which takes over from the splash, and the
// first-sync screen after it (SplashStage).
const SPLASH_BACKGROUND = '#2E108C';
// The Android app icon's background, the light cyan of the icon art (not the splash's); the same
// cyan as colors.octopus.bubble.
const ICON_BACKGROUND = '#B1F1FF';

const baseConfig = {
  expo: {
    name: 'Squidbox',
    slug: 'squidbox',
    version: '0.0.1',
    // The native fingerprint (fingerprint.config.js says what doesn't count): an update reaches only
    // a build with the same native code.
    runtimeVersion: { policy: 'fingerprint' },
    // A build checks its channel (eas.json) on launch and runs a new update from the next launch.
    updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` },
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
      infoPlist: {
        // Light status bar text on the violet launch screen. React Native's StatusBar takes over after
        // launch (SplashStage sets light while it shows; once its last <StatusBar> unmounts, RN
        // restores its default, dark on the light app), which the second key lets it do app-wide.
        UIStatusBarStyle: 'UIStatusBarStyleLightContent',
        UIViewControllerBasedStatusBarAppearance: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: ICON_BACKGROUND,
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      // Which EAS build this is (EAS sets EAS_BUILD_PROFILE; an update carries the profile it was
      // published for); unset for any other build, which counts as a release. src/utils/isTestBuild.ts reads it.
      buildProfile: process.env.EAS_BUILD_PROFILE,
      gitCommit: gitCommit(),
      eas: {
        projectId: EAS_PROJECT_ID,
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

requirePushedSnapshot(baseConfig.expo.extra.gitCommit);

module.exports = baseConfig;
