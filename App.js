// Must be at the top of the file according to https://reactnavigation.org/docs/stack-navigator/
// eslint-disable-next-line import/no-duplicates
import 'react-native-gesture-handler';

import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect } from 'react';
// eslint-disable-next-line import/no-duplicates
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MenuProvider } from 'react-native-popup-menu';

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
import useInitializeLocalData from '@/utils/local-data/useInitializeLocalData';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}

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
              <RootNavigator />
            </AssetPickerProvider>
          </MenuProvider>
        </ActionSheetProvider>
      </NavigationContainer>
    </AssetThumbnailLoaderProvider>
  );
}
