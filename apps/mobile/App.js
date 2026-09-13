/* eslint-disable import/first */

// Must be at the top of the file according to https://reactnavigation.org/docs/stack-navigator/
// eslint-disable-next-line import/no-duplicates
import 'react-native-gesture-handler';

// eslint-disable-next-line import/order
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://768b883ed2b06fea89a6978b62a36798@o4506870940106752.ingest.us.sentry.io/4506871127605248',
  // If `true`, Sentry will try to print out useful debugging information if something goes wrong with
  // sending the event. Set it to `false` in production
  debug: process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true',
  enableInExpoDevelopment: false,
});

import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { NavigationContainer } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
// eslint-disable-next-line import/no-duplicates
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Menu, MenuProvider } from 'react-native-popup-menu';

// Must be imported here so the setDefaultRenderer call below runs before other imports; order rule disabled.
// eslint-disable-next-line import/order
import BlurPopoverRenderer from '@/components/popup-menu-options/BlurPopoverRenderer';

Menu.setDefaultRenderer(BlurPopoverRenderer);
import { SafeAreaProvider } from 'react-native-safe-area-context';

import FloatingBarsProvider from '@/components/floating-bars/FloatingBarsProvider';
import FloatingFilterModal from '@/components/floating-bars/FloatingFilterModal';
import FloatingNavigationBar from '@/components/floating-bars/FloatingNavigationBar';
import ProgressOverlayProvider from '@/components/progress-overlay/ProgressOverlayProvider';
import AlbumsProvider from '@/features/albums-context/AlbumsProvider';
import AppSettingsProvider from '@/features/app-settings/AppSettingsProvider';
import AssetPickerProvider from '@/features/asset-picker/AssetPickerProvider';
import AssetThumbnailLoaderProvider from '@/features/asset-thumbnail-loader/AssetThumbnailLoaderProvider';
import AssetsProvider from '@/features/assets-context/AssetsProvider';
import CloudProvider from '@/features/cloud/CloudProvider';
import useCloud from '@/features/cloud/useCloud';
import CloudSyncProvider from '@/features/cloud-sync/CloudSyncProvider';
import PostsProvider from '@/features/posts-context/PostsProvider';
import FirstSyncScreen from '@/features/sync-status/FirstSyncScreen';
import RootNavigator from '@/navigators/RootNavigator';
import { colors } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import migrations from '@/sync/db/migrations/migrations';
import { useFirstSyncDone } from '@/sync/useSyncStatus';
import useSyncTriggers from '@/sync/useSyncTriggers';

// eslint-disable-next-line import/order
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

// eslint-disable-next-line import/order
import { defineCollection } from '@squidbox/shared';

// Phase 0 monorepo-wiring probe: import a runtime VALUE from the workspace package
// @squidbox/shared and touch it, so Metro must actually resolve the package in the running
// bundle. A type-only import would be erased and prove nothing. Remove once the shared
// package has real consumers (sync descriptors, Phase 2+).
if (__DEV__) {
  console.log('[phase0] @squidbox/shared wired:', typeof defineCollection === 'function');
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ProgressOverlayProvider>
          <AppSettingsProvider>
            <CloudProvider>
              <MigrationGate>
                <AppInit>
                  <AppGate />
                </AppInit>
              </MigrationGate>
            </CloudProvider>
          </AppSettingsProvider>
        </ProgressOverlayProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

// One-time app init: restore the cloud session + hide the splash, and mount the foreground/interval
// sync triggers. Lives ABOVE the gate so it runs exactly once and keeps the sync running whether the
// setup screen or the main app is showing. Renders nothing until ready.
function AppInit({ children }) {
  const { initializeCloudAsync } = useCloud();
  const [appIsReady, setAppIsReady] = useState(false);

  // Foreground + interval sync triggers (on-mutation is kicked from the providers). Mounted here so
  // the sync keeps running while the setup screen shows, before the data providers exist.
  useSyncTriggers();

  useEffect(() => {
    async function prepare() {
      // TODO: a bare try/catch here swallows the stack trace, making failures (e.g. a migration
      // "Cannot read property 'split' of undefined") impossible to locate. Needs a real error path.
      await initializeCloudAsync();
      setAppIsReady(true);
      // NOTE: the splash is hidden later, by AppGate, once it knows which screen to show — so the
      // native splash covers init AND the firstSyncDone read (no blank/flash in between).
    }
    prepare();
  }, []);

  if (!appIsReady) return null;
  return children;
}

// DB migrations run once, above everything that queries SQLite (including the firstSyncDone probe
// in AppGate). Renders nothing until the schema is ready.
function MigrationGate({ children }) {
  const { success, error } = useMigrations(getDb(), migrations);
  if (error) throw error; // fail loudly in dev — the DB must migrate before use
  if (!success) return null; // brief: first-launch migration
  return children;
}

// The one gate: while the initial library pull runs, show the setup screen and DON'T mount the data
// providers, so nothing heavy competes with the bulk pull. The moment it finishes, the providers
// mount for the first time and read the complete library in a single clean pass — no paused
// queries, no remount tricks. Gate on "logged in AND the initial pull hasn't finished" (not the
// cursor), so it's up from the instant we log in through any transient error; pre-login it's off.
function AppGate() {
  const { isAuthenticated } = useCloud();
  const firstSyncDone = useFirstSyncDone();

  // Hide the native splash only once the first real screen has laid out — so the splash covers init
  // AND the firstSyncDone read, with no blank frame or setup-screen flash in between.
  const onLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // firstSyncDone is undefined until sync_meta has been read once; keep the splash up (return null)
  // until the flag is known, so we never gate on a not-yet-loaded value.
  if (firstSyncDone === undefined) return null;

  const content =
    isAuthenticated && !firstSyncDone ? (
      <FirstSyncScreen />
    ) : (
      <AssetsProvider>
        <AlbumsProvider>
          <PostsProvider>
            <CloudSyncProvider>
              <MainApp />
            </CloudSyncProvider>
          </PostsProvider>
        </AlbumsProvider>
      </AssetsProvider>
    );

  return (
    <View style={styles.root} onLayout={onLayout}>
      {content}
    </View>
  );
}

export default Sentry.wrap(App);

function MainApp() {
  return (
    <AssetThumbnailLoaderProvider>
      <NavigationContainer>
        <ActionSheetProvider>
          <MenuProvider>
            <AssetPickerProvider>
              <FloatingBarsProvider>
                <View style={styles.root}>
                  <LinearGradient
                    colors={colors.appBackground}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <RootNavigator />
                  <FloatingNavigationBar />
                  <FloatingFilterModal />
                </View>
              </FloatingBarsProvider>
            </AssetPickerProvider>
          </MenuProvider>
        </ActionSheetProvider>
      </NavigationContainer>
    </AssetThumbnailLoaderProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
