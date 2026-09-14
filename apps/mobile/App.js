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
import { useState, useEffect, Component } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { enableSync } from '@/sync/worker';

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

// Catches render-time throws during boot (e.g. a failed DB migration) that would otherwise unmount
// the tree to a blank root behind the still-visible native splash — a silent dead-end in a release
// build. Lifts the splash and shows a recoverable message instead.
class BootErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    Sentry.captureException(error);
    SplashScreen.hideAsync().catch(() => {}); // never leave the splash up on a crash
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.bootError}>
          <Text style={styles.bootErrorTitle}>Something went wrong</Text>
          <Text style={styles.bootErrorText}>
            Please close and reopen the app. If it keeps happening, reinstall.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BootErrorBoundary>
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
        </BootErrorBoundary>
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

  // Foreground + interval sync triggers. The launch pull is kicked by enableSync() below (once init
  // is done); requestSync() is a no-op until then, so the sync can't start before init and starve
  // its DB work (which would strand the splash).
  useSyncTriggers();

  useEffect(() => {
    let revealed = false;
    // The splash's ONLY exit. Idempotent. Always runs — even if init throws or hangs — so a release
    // build (no redbox) can never get stranded on the native splash.
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      setAppIsReady(true);
      enableSync(); // init done → allow syncing and kick the first pull (never before, see worker)
      SplashScreen.hideAsync().catch(() => {}); // no-op if already hidden
    };

    async function prepare() {
      try {
        await initializeCloudAsync();
      } catch (error) {
        // Never let an init failure strand the splash. Report it and boot anyway — the login/gate
        // flow can recover (e.g. show the login screen) instead of an invisible dead splash.
        Sentry.captureException(error);
      } finally {
        reveal();
      }
    }
    prepare();

    // Watchdog: if init HANGS (e.g. an unreachable API with no request timeout), lift the splash
    // anyway after a bound so the user is never stuck. Init keeps running and updates state later.
    const watchdog = setTimeout(reveal, 8000);
    return () => clearTimeout(watchdog);
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

  // firstSyncDone is undefined until sync_meta has been read once (a live query yields [] on its
  // first render). Render nothing for that brief moment so we never gate on a not-yet-loaded value
  // and flash the setup screen. The splash is already hidden by AppInit, so this is at most a
  // sub-second blank, never a stuck screen.
  if (firstSyncDone === undefined) return null;
  if (isAuthenticated && !firstSyncDone) return <FirstSyncScreen />;

  return (
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
  bootError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  bootErrorTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  bootErrorText: { fontSize: 15, opacity: 0.7, textAlign: 'center', lineHeight: 20 },
});
