import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { NavigationContainer } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect, useCallback, Component, Fragment, createContext, memo, use } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Menu, MenuProvider } from 'react-native-popup-menu';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import FloatingBarsProvider from '@/components/floating-bars/FloatingBarsProvider';
import FloatingNavigationBar from '@/components/floating-bars/FloatingNavigationBar';
import BlurPopoverRenderer from '@/components/popup-menu-options/BlurPopoverRenderer';
import ProgressOverlayProvider from '@/components/progress-overlay/ProgressOverlayProvider';
import AlbumsProvider from '@/features/albums-context/AlbumsProvider';
import AppSettingsProvider from '@/features/app-settings/AppSettingsProvider';
import AssetPickerProvider from '@/features/asset-picker/AssetPickerProvider';
import AssetThumbnailLoaderProvider from '@/features/asset-thumbnail-loader/AssetThumbnailLoaderProvider';
import AssetsProvider from '@/features/assets-context/AssetsProvider';
import BootScreen from '@/features/boot/BootScreen';
import CloudProvider from '@/features/cloud/CloudProvider';
import useCloud from '@/features/cloud/useCloud';
import CloudSyncProvider from '@/features/cloud-sync/CloudSyncProvider';
import RandomSuggestionsProvider from '@/features/post-random-suggestions/RandomSuggestionsProvider';
import PostsProvider from '@/features/posts-context/PostsProvider';
import FirstSyncScreen from '@/features/sync-status/FirstSyncScreen';
import LibraryProvider from '@/library/LibraryProvider';
import SwitchingScreen from '@/library/SwitchingScreen';
import { getLibrary } from '@/library/current';
import { currentSyncIdentity } from '@/library/currentSyncIdentity';
import useLibrary from '@/library/useLibrary';
import usePendingMerges from '@/library/usePendingMerges';
import RootNavigator from '@/navigators/RootNavigator';
import { navigationRef, flushPendingNavigation } from '@/navigators/navigationRef';
import { colors } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { useFirstSyncDone } from '@/sync/useSyncStatus';
import useSyncTriggers from '@/sync/useSyncTriggers';
import { setSyncTarget } from '@/sync/worker';

// Module setup. Imports are hoisted, so this runs once every import above has loaded.
Sentry.init({
  dsn: 'https://768b883ed2b06fea89a6978b62a36798@o4506870940106752.ingest.us.sentry.io/4506871127605248',
  // Verbose Sentry logging, for debugging event delivery. Off unless enabled in .env.local.
  debug: process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true',
});
Menu.setDefaultRenderer(BlurPopoverRenderer);
// The native splash stays up until BootScreen, which looks just like it, is on screen.
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
          <Text style={styles.bootErrorText}>Please close and reopen the app. If it keeps happening, reinstall.</Text>
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
              <LibraryProvider>
                <CloudProvider>
                  <AppInit>
                    <LibraryGate>
                      <AppGate />
                    </LibraryGate>
                  </AppInit>
                </CloudProvider>
              </LibraryProvider>
            </AppSettingsProvider>
          </ProgressOverlayProvider>
        </BootErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

// Called by AppGate once it shows a screen (FirstSyncScreen or the app): the boot screen's cue to go.
const AppShownContext = createContext(() => {});

// One-time app init: the boot screen (the native splash's twin, with the octopus moving) until the
// boot (LibraryProvider: the library open and the cloud session check, side by side) is through and
// the gates below show a screen, which the boot screen then fades out over; and the
// foreground/interval sync triggers. Lives ABOVE the gates so it runs exactly once and keeps the sync
// running whether the setup screen or the main app is showing.
function AppInit({ children }) {
  const { isAuthenticated } = useCloud();
  const { booted } = useLibrary();
  const [appIsReady, setAppIsReady] = useState(false);
  const [appShown, setAppShown] = useState(false);
  const showApp = useCallback(() => setAppShown(true), []);

  // Foreground + interval sync triggers. They're no-ops without a sync target (below).
  useSyncTriggers();

  // Sync only once the boot is done (so it can't starve the boot's DB work and strand the splash)
  // AND someone is signed in for the open library: that library (its database and folders) and
  // identity are the sync's target.
  // Setting one kicks the launch pull; signing out or a rejected session clears it.
  useEffect(() => {
    const identity = appIsReady && isAuthenticated ? currentSyncIdentity() : null;
    setSyncTarget(identity && { db: getDb(), identity, library: getLibrary() });
  }, [appIsReady, isAuthenticated]);

  // While the boot hangs (an unreachable API, a long migration) the octopus stays up and moving. A
  // crash during it is BootErrorBoundary's, which replaces all of this and hides the native splash
  // (otherwise BootScreen's to hide).
  useEffect(() => {
    if (booted) setAppIsReady(true);
  }, [booted]);

  return (
    <>
      <AppShownContext value={showApp}>{appIsReady && children}</AppShownContext>
      <BootScreen leaving={appShown} />
    </>
  );
}

// Everything that queries SQLite (including the firstSyncDone probe in AppGate) mounts under the
// open library, keyed by it, so another library means a fresh tree. Renders nothing while the boot
// library opens and migrates (brief; longer on a first launch), and the switching screen while one
// library closes and another opens, so no screen reads across the switch.
function LibraryGate({ children }) {
  const { library, switching } = useLibrary();
  if (switching) return <SwitchingScreen />;
  if (!library) return null;
  return <Fragment key={library.id}>{children}</Fragment>;
}

// The one gate: while the initial library pull runs, show the setup screen and DON'T mount the app,
// so no screen's live reads re-run on every batch of the bulk pull. The moment it finishes, the app
// mounts and each screen reads its first page. Gate on "logged in AND the initial pull hasn't
// finished" (not the cursor), so it's up from the instant we log in through any transient error;
// pre-login it's off.
function AppGate() {
  const { isAuthenticated } = useCloud();
  const firstSyncDone = useFirstSyncDone();
  usePendingMerges(firstSyncDone);
  const showApp = use(AppShownContext);
  const showing = firstSyncDone !== undefined;

  useEffect(() => {
    if (showing) showApp();
  }, [showing, showApp]);

  // firstSyncDone is undefined until sync_meta has been read once (a live query yields [] on its
  // first render). Render nothing for that brief moment so we never gate on a not-yet-loaded value
  // and flash the setup screen; the boot screen stays up over it.
  if (!showing) return null;
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

// Memoized: a change of AppGate's cloud state must not re-render the whole app below it.
const MainApp = memo(function MainApp() {
  return (
    <AssetThumbnailLoaderProvider>
      <NavigationContainer ref={navigationRef} onReady={flushPendingNavigation}>
        <ActionSheetProvider>
          <MenuProvider>
            <AssetPickerProvider>
              <RandomSuggestionsProvider>
                <FloatingBarsProvider>
                  <View style={styles.root}>
                    <LinearGradient
                      colors={colors.background.app}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <RootNavigator />
                    <FloatingNavigationBar />
                  </View>
                </FloatingBarsProvider>
              </RandomSuggestionsProvider>
            </AssetPickerProvider>
          </MenuProvider>
        </ActionSheetProvider>
      </NavigationContainer>
    </AssetThumbnailLoaderProvider>
  );
});

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
