import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import CloudContext from './CloudContext';
import downloadAssetFileAsync from './assets/downloadAssetFileAsync';
import preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';
import uploadAssetFileAsync from './assets/uploadAssetFileAsync';
import uploadAssetThumbnailAsync from './assets/uploadAssetThumbnailAsync';
import initializeCloudAsyncFn from './initializeCloudAsync';

import { getLibrary, whenLibraryOpen } from '@/library/current';
import deviceLabel from '@/library/deviceLabel';
import { removeLibrary } from '@/library/removeLibrary';
import { openLibraryForSession } from '@/library/sessionLibrary';
import { isSessionAuthenticated, needsReauth as sessionNeedsReauth } from '@/library/sessionMatches';
import useLibrary from '@/library/useLibrary';
import { navigateToTab } from '@/navigators/navigationRef';
import { withSyncPaused } from '@/sync/worker';
import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';
import apiLoginAsync from '@/utils/cloud-api/authentication/loginAsync';
import apiLogoutAsync from '@/utils/cloud-api/authentication/logoutAsync';
import { onSessionExpired } from '@/utils/cloud-api/sessionExpiry';
import { getSessionAsync, setSessionAsync } from '@/utils/cloud-api/sessionStore';

// The session: who is signed in. It is also the open pointer of the libraries: a session opens its
// owner's library, none opens this device's (library/sessionLibrary.ts). Every change of it runs
// inside withSyncPaused together with the library switch it causes, so no sync run spans either.
export default function CloudProvider({ children }) {
  const { library, switchLibrary } = useLibrary();
  const [session, setSession] = useState(null);

  const isAuthenticated = library !== null && isSessionAuthenticated(library, session, API_BASE_URL);
  const needsReauth = library !== null && sessionNeedsReauth(library, session);
  const user = session?.userId ? { id: session.userId, email: session.email } : null;

  // A rejected refresh dropped the tokens; the library stays open and editable, nothing syncs until
  // its owner signs in again.
  useEffect(
    () =>
      onSessionExpired(async () => {
        const expired = await getSessionAsync();
        setSession(expired);
        Alert.alert(
          'Sign in to keep syncing',
          `Your session for ${expired?.email ?? 'your account'} ended. Your changes are saved on ${deviceLabel()} and will upload after you sign in.`,
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Sign In', onPress: () => navigateToTab('SettingsTab') },
          ],
        );
      }),
    [],
  );

  // Take the session `authenticate` resolves to (the stored one, verified, at boot; a new one at
  // sign-in) and open its library. A switch that fails puts the previous session back and throws.
  async function startSessionAsync(authenticate) {
    await whenLibraryOpen();
    const next = await withSyncPaused(async () => {
      const previous = await getSessionAsync();
      const authenticated = await authenticate();
      await openLibraryForSession(authenticated, previous, switchLibrary);
      return authenticated;
    });
    setSession(next);
  }

  // Signing out clears the session and returns to this device's library; the account's stays on
  // the device, parked, unless `remove` asks for it to go. Then the refresh token is revoked as
  // best effort, outside the paused section. If the device library won't open, the session stays.
  async function endSessionAsync({ remove = false } = {}) {
    const { previous, parkedId } = await withSyncPaused(async () => {
      const current = await getSessionAsync();
      const { id } = getLibrary();
      await setSessionAsync(null);
      await openLibraryForSession(null, current, switchLibrary);
      setSession(null);
      return { previous: current, parkedId: id };
    });
    if (remove) await removeLibrary(parkedId);
    if (previous?.tokens) await apiLogoutAsync(previous.tokens.refreshToken);
  }

  const value = useMemo(
    () => ({
      isAuthenticated,
      needsReauth,
      user,
      initializeCloudAsync: () => startSessionAsync(initializeCloudAsyncFn),
      loginAsync: (email, password) => startSessionAsync(() => apiLoginAsync(email, password)),
      logoutAsync: (options) =>
        endSessionAsync(options).catch((error) => Alert.alert("Couldn't sign out", error.message)),
      preloadAssetThumbnailsAsync,
      uploadAssetFileAsync,
      uploadAssetThumbnailAsync,
      downloadAssetFileAsync,
    }),
    [session, library, switchLibrary],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}
