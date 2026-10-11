import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import CloudContext from './CloudContext';
import downloadAssetFileAsync from './assets/downloadAssetFileAsync';
import preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';
import uploadAssetFileAsync from './assets/uploadAssetFileAsync';
import uploadAssetThumbnailAsync from './assets/uploadAssetThumbnailAsync';
import initializeCloudAsyncFn from './initializeCloudAsync';

import setUserAsync from '@/features/cloud/user/setUserAsync';
import { navigateToTab } from '@/navigators/navigationRef';
import { resetSyncForUser, withSyncPaused } from '@/sync/worker';
import apiLoginAsync from '@/utils/cloud-api/authentication/loginAsync';
import apiLogoutAsync from '@/utils/cloud-api/authentication/logoutAsync';
import { onSessionExpired } from '@/utils/cloud-api/sessionExpiry';

export default function CloudProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(
    () =>
      onSessionExpired(async () => {
        await endSessionAsync();
        Alert.alert('Signed out', 'Your session has expired. Please sign in again.', [
          { text: 'Later', style: 'cancel' },
          { text: 'Sign in', onPress: () => navigateToTab('SettingsTab') },
        ]);
      }),
    [],
  );

  // Sign in as the user `authenticate` resolves to, or sign out if it resolves to null. Syncing stays
  // paused from before the session tokens change until the local data belongs to that user: a
  // DIFFERENT account wipes the local slate first. So no in-flight sync can push the previous
  // account's pending changes with the new session, and the gate never shows the previous library.
  async function startSessionAsync(authenticate) {
    const signedInUser = await withSyncPaused(async (db) => {
      const authenticatedUser = await authenticate();
      if (authenticatedUser) await resetSyncForUser(db, authenticatedUser.id);
      return authenticatedUser;
    });
    if (!signedInUser) return endSessionAsync();

    // Set the user before isAuthenticated (and unset in reverse), or the UI reads a null user.
    setUser(signedInUser);
    setIsAuthenticated(true);
    await setUserAsync(signedInUser);
  }

  // Signing out keeps the local library (it's this user's data on their device). It's only wiped
  // when a DIFFERENT account signs in, see startSessionAsync.
  async function endSessionAsync() {
    setIsAuthenticated(false);
    setUser(null);
    await setUserAsync(null);
  }

  const value = useMemo(
    () => ({
      isAuthenticated,
      user,
      initializeCloudAsync: () => startSessionAsync(initializeCloudAsyncFn),
      loginAsync: async (email, password) => {
        try {
          await startSessionAsync(() => apiLoginAsync(email, password));
        } catch (error) {
          await endSessionAsync();
          throw error;
        }
      },
      logoutAsync: async () => {
        try {
          await apiLogoutAsync();
        } finally {
          await endSessionAsync();
        }
      },
      preloadAssetThumbnailsAsync,
      uploadAssetFileAsync,
      uploadAssetThumbnailAsync,
      downloadAssetFileAsync,
    }),
    [isAuthenticated, user],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}
