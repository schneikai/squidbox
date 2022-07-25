import { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { auth } from "root/firebase.config";
import { signInAnonymously } from "firebase/auth";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";

import { BlockingProgressProvider } from "components/BlockingProgress";
import RootNavigator from "navigation/RootNavigator";
import { handleError } from "services/ErrorHandling";

import { Provider as AssetBackgroundUploaderProvider } from "components/AssetBackgroundUploader";

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
        await signInAnonymously(auth);
        await SplashScreen.hideAsync();
        setAppIsReady(true);
      } catch (err) {
        handleError("Failed to initialize app! Cannot continue!", err);
      }
    }

    prepare();
  }, []);

  if (appIsReady) {
    return (
      <ActionSheetProvider>
        <AssetBackgroundUploaderProvider>
          <BlockingProgressProvider>
            <RootNavigator />
          </BlockingProgressProvider>
        </AssetBackgroundUploaderProvider>
      </ActionSheetProvider>
    );
  } else {
    return <></>;
  }
}
