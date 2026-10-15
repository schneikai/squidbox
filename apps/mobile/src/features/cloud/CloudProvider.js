import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import CloudContext from './CloudContext';
import downloadAssetFileAsync from './assets/downloadAssetFileAsync';
import preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';
import uploadAssetFileAsync from './assets/uploadAssetFileAsync';
import uploadAssetThumbnailAsync from './assets/uploadAssetThumbnailAsync';

import { getLibrary } from '@/library/current';
import deviceLabel from '@/library/deviceLabel';
import { deviceLibrary, getRegistry } from '@/library/registry';
import { removeLibrary } from '@/library/removeLibrary';
import { sameAccount } from '@/library/sameAccount';
import { openLibraryForSession } from '@/library/sessionLibrary';
import { isSessionAuthenticated, needsReauth as sessionNeedsReauth } from '@/library/sessionMatches';
import useLibrary from '@/library/useLibrary';
import { navigateToTab } from '@/navigators/navigationRef';
import { withSyncPaused } from '@/sync/worker';
import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';
import apiLoginAsync from '@/utils/cloud-api/authentication/loginAsync';
import apiLogoutAsync from '@/utils/cloud-api/authentication/logoutAsync';
import { getSession, onSessionChange, updateSession } from '@/utils/cloud-api/sessionStore';

// The session is loaded by the boot (LibraryProvider); until then there is none.
function readSession() {
  try {
    return getSession();
  } catch {
    return null;
  }
}

// A rejected refresh (or a /me that said no) dropped the tokens of the session that is still there.
function tokensDropped(previous, session) {
  return Boolean(previous?.tokens) && session !== null && session.tokens === null && sameAccount(previous, session);
}

// The session: who is signed in, mirrored from the session store. It is also the open pointer of the
// libraries: a session opens its owner's library, none opens this device's
// (library/sessionLibrary.ts). Every change of it runs inside withSyncPaused together with the
// library switch it causes, so no sync run spans either.
export default function CloudProvider({ children }) {
  const { library, switchLibrary } = useLibrary();
  const session = useSyncExternalStore(onSessionChange, readSession);
  // The device library to offer to the account after a sign-in (MergeOffer), once per sign-in.
  const [mergeOffer, setMergeOffer] = useState(null);
  const previousSession = useRef(session);

  const isAuthenticated = library !== null && isSessionAuthenticated(library, session, API_BASE_URL);
  const needsReauth = library !== null && sessionNeedsReauth(library, session);
  const user = session?.userId ? { id: session.userId, email: session.email } : null;

  // The server rejected the tokens; the library stays open and editable, nothing syncs until its
  // owner signs in again.
  useEffect(() => {
    const previous = previousSession.current;
    previousSession.current = session;
    if (!tokensDropped(previous, session)) return;
    Alert.alert(
      'Sign in to keep syncing',
      `Your session for ${session.email ?? 'your account'} ended. Your changes are saved on ${deviceLabel()} and will upload after you sign in.`,
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigateToTab('SettingsTab') },
      ],
    );
  }, [session]);

  // Signs in and opens the account's library. A switch that fails puts the previous session back and
  // throws. Afterwards, this device's library (if parked) is offered to the account once.
  async function loginAsync(email, password) {
    await withSyncPaused(async () => {
      const previous = getSession();
      await openLibraryForSession(await apiLoginAsync(email, password), previous, switchLibrary);
    });
    setMergeOffer(deviceLibrary(getRegistry().libraries)?.id ?? null);
  }

  // Signing out clears the session and returns to this device's library; if the device library
  // won't open, the session stays. Then the refresh token is revoked as best effort, outside the
  // paused section, and the account's library stays on the device, parked, unless `remove` asks for
  // it to go: a removal that fails leaves it listed, to be removed under Libraries.
  async function logoutAsync({ remove = false } = {}) {
    let signedOut;
    try {
      signedOut = await withSyncPaused(async () => {
        const previous = getSession();
        const parkedId = getLibrary().id;
        await updateSession(() => null);
        await openLibraryForSession(null, previous, switchLibrary);
        return { previous, parkedId };
      });
    } catch (error) {
      Alert.alert("Couldn't sign out", error.message);
      return;
    }
    if (signedOut.previous?.tokens) await apiLogoutAsync(signedOut.previous.tokens.refreshToken);
    if (!remove) return;
    try {
      await removeLibrary(signedOut.parkedId);
    } catch (error) {
      Alert.alert("Signed out, but the library couldn't be removed", `${error.message}\nRemove it under Libraries.`);
    }
  }

  const value = useMemo(
    () => ({
      isAuthenticated,
      needsReauth,
      user,
      loginAsync,
      logoutAsync,
      mergeOffer,
      dismissMergeOffer: () => setMergeOffer(null),
      preloadAssetThumbnailsAsync,
      uploadAssetFileAsync,
      uploadAssetThumbnailAsync,
      downloadAssetFileAsync,
    }),
    [session, library, switchLibrary, mergeOffer],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}
