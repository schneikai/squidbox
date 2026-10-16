// Matched by colors.splashBackground, for BootScreen, which takes over from the splash.
const SPLASH_BACKGROUND = '#B1F1FF';

const baseConfig = {
  expo: {
    name: 'Squidbox',
    slug: 'squidbox',
    version: '0.0.1',
    // Bump whenever native modules change, so an OTA bundle is never delivered to a binary that
    // lacks a module it needs.
    runtimeVersion: '1.0.0',
    orientation: 'portrait',
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
      eas: {
        projectId: 'e74016a5-b902-4dca-9c35-f1ef376c4f52',
      },
    },
    plugins: [
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
      '@react-native-community/datetimepicker',
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
  baseConfig.expo.ios = {
    ...baseConfig.expo.ios,
    bundleIdentifier: 'com.schneikai.squidbox.dev',
  };
}

module.exports = baseConfig;
