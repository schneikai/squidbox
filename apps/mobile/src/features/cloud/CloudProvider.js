import { useMemo, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import CloudContext from './CloudContext';
import preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';
import uploadAssetFileAsync from './assets/uploadAssetFileAsync';
import uploadAssetThumbnailAsync from './assets/uploadAssetThumbnailAsync';

import { openLibraryForSignIn, openLibraryForSignOut } from '@/library/sessionLibrary';
import { isSessionAuthenticated, needsReauth as sessionNeedsReauth } from '@/library/sessionMatches';
import useLibrary from '@/library/useLibrary';
import { navigateToTab } from '@/navigators/navigationRef';
import { withSyncPaused } from '@/sync/worker';
import apiLoginAsync from '@/utils/cloud-api/authentication/loginAsync';
import apiLogoutAsync from '@/utils/cloud-api/authentication/logoutAsync';
import { getSessionSnapshot, onSessionChange } from '@/utils/cloud-api/sessionStore';

// Who is signed in, mirrored from the session store. Every change of the session runs inside
// withSyncPaused, a sign-in together with the library switch it causes (library/sessionLibrary.ts),
// so no sync or backup run spans either.
export default function CloudProvider({ children }) {
  const { library, switchLibrary } = useLibrary();
  const session = useSyncExternalStore(onSessionChange, getSessionSnapshot);

  const isAuthenticated = library !== null && isSessionAuthenticated(library, session);
  const needsReauth = library !== null && sessionNeedsReauth(library, session);
  const user = session?.userId ? { id: session.userId, email: session.email } : null;

  // Signs in and opens the account's library (a parked one, or a new one), adding what this device's
  // library holds; the library of another account stays parked with its pending changes.
  async function loginAsync(email, password) {
    const next = await apiLoginAsync(email, password);
    const switched = await withSyncPaused(() => openLibraryForSignIn(next, switchLibrary));
    // The remount after a switch reset the navigation; a sign-in ends where it began, in Settings.
    if (switched) navigateToTab('SettingsTab');
  }

  // Signs out: the sync and backup stop, the tokens go and openLibraryForSignOut opens the library for
  // the session without them. The refresh token is then revoked as best effort, outside the paused
  // section.
  async function logoutAsync() {
    let tokens;
    try {
      tokens = await withSyncPaused(() => openLibraryForSignOut(switchLibrary));
    } catch (error) {
      Alert.alert("Couldn't sign out", error.message);
      return;
    }
    if (tokens) await apiLogoutAsync(tokens.refreshToken);
  }

  const value = useMemo(
    () => ({
      isAuthenticated,
      needsReauth,
      user,
      loginAsync,
      logoutAsync,
      preloadAssetThumbnailsAsync,
      uploadAssetFileAsync,
      uploadAssetThumbnailAsync,
    }),
    [session, library, switchLibrary],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}
