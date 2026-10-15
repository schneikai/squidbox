import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import CloudContext from './CloudContext';
import downloadAssetFileAsync from './assets/downloadAssetFileAsync';
import preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';
import uploadAssetFileAsync from './assets/uploadAssetFileAsync';
import uploadAssetThumbnailAsync from './assets/uploadAssetThumbnailAsync';
import initializeCloudAsyncFn from './initializeCloudAsync';

import { navigateToTab } from '@/navigators/navigationRef';
import { resetSyncForUser, withSyncPaused } from '@/sync/worker';
import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';
import apiLoginAsync from '@/utils/cloud-api/authentication/loginAsync';
import apiLogoutAsync from '@/utils/cloud-api/authentication/logoutAsync';
import { onSessionExpired } from '@/utils/cloud-api/sessionExpiry';
import { getSessionAsync, setSessionAsync } from '@/utils/cloud-api/sessionStore';

// A session counts once it has tokens obtained from the current base URL (initializeCloudAsync
// rebinds a session whose server proved to be the same).
function isSessionAuthenticated(session) {
  return Boolean(session?.tokens) && session.apiBaseUrl === API_BASE_URL;
}

export default function CloudProvider({ children }) {
  const [session, setSession] = useState(null);

  const isAuthenticated = isSessionAuthenticated(session);
  const user = session?.userId ? { id: session.userId, email: session.email } : null;

  useEffect(
    () =>
      onSessionExpired(async () => {
        setSession(await getSessionAsync());
        Alert.alert('Signed out', 'Your session has expired. Please sign in again.', [
          { text: 'Later', style: 'cancel' },
          { text: 'Sign in', onPress: () => navigateToTab('SettingsTab') },
        ]);
      }),
    [],
  );

  // Take the session `authenticate` resolves to. Syncing stays paused from before the session changes
  // until the local data belongs to that user: a DIFFERENT account wipes the local slate first. So no
  // in-flight sync can push the previous account's pending changes with the new session, and the gate
  // never shows the previous library.
  async function startSessionAsync(authenticate) {
    const nextSession = await withSyncPaused(async (db) => {
      const authenticated = await authenticate();
      if (isSessionAuthenticated(authenticated)) await resetSyncForUser(db, authenticated.userId);
      return authenticated;
    });
    setSession(nextSession);
  }

  // Signing out clears the session here first, then revokes its refresh token as best effort. The
  // local library stays (it's this user's data on their device); it's only wiped when a DIFFERENT
  // account signs in, see startSessionAsync.
  async function endSessionAsync() {
    const current = await getSessionAsync();
    await setSessionAsync(null);
    setSession(null);
    if (current?.tokens) await apiLogoutAsync(current.tokens.refreshToken);
  }

  const value = useMemo(
    () => ({
      isAuthenticated,
      user,
      initializeCloudAsync: () => startSessionAsync(initializeCloudAsyncFn),
      loginAsync: (email, password) => startSessionAsync(() => apiLoginAsync(email, password)),
      logoutAsync: endSessionAsync,
      preloadAssetThumbnailsAsync,
      uploadAssetFileAsync,
      uploadAssetThumbnailAsync,
      downloadAssetFileAsync,
    }),
    [session],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}
