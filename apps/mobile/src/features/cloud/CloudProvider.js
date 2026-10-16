import { useMemo, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import CloudContext from './CloudContext';
import downloadAssetFileAsync from './assets/downloadAssetFileAsync';
import preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';
import uploadAssetFileAsync from './assets/uploadAssetFileAsync';
import uploadAssetThumbnailAsync from './assets/uploadAssetThumbnailAsync';

import { openLibraryForSignIn, signOut } from '@/library/sessionLibrary';
import { isSessionAuthenticated, needsReauth as sessionNeedsReauth } from '@/library/sessionMatches';
import useLibrary from '@/library/useLibrary';
import { withSyncPaused } from '@/sync/worker';
import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';
import apiLoginAsync from '@/utils/cloud-api/authentication/loginAsync';
import apiLogoutAsync from '@/utils/cloud-api/authentication/logoutAsync';
import { getSession, onSessionChange } from '@/utils/cloud-api/sessionStore';

// The session is loaded by the boot (LibraryProvider); until then there is none.
function readSession() {
  try {
    return getSession();
  } catch {
    return null;
  }
}

// The session: who is signed in, mirrored from the session store. It is also the open pointer of the
// libraries: a session opens its owner's library, with or without tokens, none opens this device's
// (library/sessionLibrary.ts). Every change of it runs inside withSyncPaused together with the
// library switch it causes, so no sync run spans either. An account backs the library up and keeps
// it in sync; signing out, or a session the server rejected (needsReauth), only pauses that.
export default function CloudProvider({ children }) {
  const { library, switchLibrary } = useLibrary();
  const session = useSyncExternalStore(onSessionChange, readSession);

  const isAuthenticated = library !== null && isSessionAuthenticated(library, session, API_BASE_URL);
  const needsReauth = library !== null && sessionNeedsReauth(library, session);
  const user = session?.userId ? { id: session.userId, email: session.email } : null;

  // Signs in and opens the account's library (a parked one, or a new one), adding what this device's
  // library holds; the library of another account stays parked with its pending changes. A switch
  // that fails puts the previous session back and throws.
  async function loginAsync(email, password) {
    await withSyncPaused(async () => {
      const previous = getSession();
      await openLibraryForSignIn(await apiLoginAsync(email, password), previous, switchLibrary);
    });
  }

  // Signs out: the sync and backup stop and the tokens go, the library stays open as it is. The
  // refresh token is then revoked as best effort, outside the paused section.
  async function logoutAsync() {
    let tokens;
    try {
      tokens = await withSyncPaused(signOut);
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
      downloadAssetFileAsync,
    }),
    [session, library, switchLibrary],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}
