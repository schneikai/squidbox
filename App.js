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
import { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
// eslint-disable-next-line import/no-duplicates
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Menu, MenuProvider } from 'react-native-popup-menu';
import BlurPopoverRenderer from '@/components/popup-menu-options/BlurPopoverRenderer';

Menu.setDefaultRenderer(BlurPopoverRenderer);
import { SafeAreaProvider } from 'react-native-safe-area-context';

import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingBarsProvider from '@/components/floating-bars/FloatingBarsProvider';
import FloatingFilterModal from '@/components/floating-bars/FloatingFilterModal';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
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
import RootNavigator from '@/navigators/RootNavigator';
import { colors } from '@/styles/designTokens';
import useInitializeLocalData from '@/utils/local-data/useInitializeLocalData';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <ProgressOverlayProvider>
      <AppSettingsProvider>
        <AssetsProvider>
          <AlbumsProvider>
            <PostsProvider>
              <CloudProvider>
                <CloudSyncProvider>
                  <AppComponent />
                </CloudSyncProvider>
              </CloudProvider>
            </PostsProvider>
          </AlbumsProvider>
        </AssetsProvider>
      </AppSettingsProvider>
      </ProgressOverlayProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(App);

function AppComponent() {
  const initializeLocalDataAsync = useInitializeLocalData();
  const { initializeCloudAsync } = useCloud();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      // TODO: I had a try/catch here but the problem with this is
      // that if we only alert the error message here and it is something
      // very general it is impossible to find out where the error
      // actually happened. We would need to have a stack trace to make
      // debugging easier. Have to do some research on how to do this.
      // The error was in a assetMigration1701510971477.js file and the error
      // was just "TypeError: Cannot read property 'split' of undefined".
      await initializeLocalDataAsync();
      await initializeCloudAsync();
      setAppIsReady(true);
      await SplashScreen.hideAsync();
    }

    prepare();
  }, []);

  if (!appIsReady) return null;

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
                  <FloatingHeader />
                  <FloatingActionsBar />
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
})
