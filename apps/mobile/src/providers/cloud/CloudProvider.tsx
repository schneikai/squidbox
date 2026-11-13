import { router } from 'expo-router';
import { type ReactNode, useMemo, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import CloudContext, { type CloudAccount, type CloudContextValue, type CloudUser } from './CloudContext';

import type { Session } from '@/library/session';
import { openLibraryForSignIn } from '@/library/sessionLibrary';
import { isSessionAuthenticated, needsReauth as sessionNeedsReauth } from '@/library/sessionMatches';
import useLibrary from '@/library/useLibrary';
import { withSyncPaused } from '@/sync/worker';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import preloadAssetThumbnailsAsync from '@/utils/cloud-api/assets/preloadAssetThumbnailsAsync';
import apiLoginAsync from '@/utils/cloud-api/authentication/loginAsync';
import apiLogoutAsync from '@/utils/cloud-api/authentication/logoutAsync';
import { dropTokensAsync, getSessionSnapshot, onSessionChange } from '@/utils/cloud-api/sessionStore';

// Who is signed in, mirrored from the session store. Every change of the session runs inside
// withSyncPaused, a sign-in together with the library switch it causes (library/sessionLibrary.ts),
// so no sync or backup run spans either.
type CloudProviderProps = { children: ReactNode };

export default function CloudProvider({ children }: CloudProviderProps) {
  const { library, switchLibrary } = useLibrary();
  const session = useSyncExternalStore(onSessionChange, getSessionSnapshot);

  const account: CloudAccount =
    library !== null && isSessionAuthenticated(library, session)
      ? { isAuthenticated: true, user: cloudUser(session) }
      : { isAuthenticated: false, user: session?.userId ? cloudUser(session) : null };
  const needsReauth = library !== null && sessionNeedsReauth(library, session);

  // Signs in and opens the account's library (a parked one, or a new one), adding what this device's
  // library holds; the library of another account stays parked with its pending changes.
  async function loginAsync(email: string, password: string) {
    const next = await apiLoginAsync(email, password);
    const switched = await withSyncPaused(() => openLibraryForSignIn(next, switchLibrary));
    // The remount after a switch reset the navigation; a sign-in ends where it began, in Settings.
    if (switched) router.navigate('/settings');
  }

  // Signs out: the sync and backup stop and the tokens go; watchTokenDrops then opens the library for
  // the session without them. The refresh token is revoked as best effort, outside the paused section.
  async function logoutAsync() {
    let tokens;
    try {
      tokens = await withSyncPaused(dropTokensAsync);
    } catch (error) {
      Alert.alert("Couldn't sign out", apiErrorMessage(error));
      return;
    }
    if (tokens) await apiLogoutAsync(tokens.refreshToken);
  }

  const value = useMemo<CloudContextValue>(
    () => ({
      ...account,
      needsReauth,
      loginAsync,
      logoutAsync,
      preloadAssetThumbnailsAsync,
    }),
    [session, library, switchLibrary],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

function cloudUser(session: Session): CloudUser {
  return { id: session.userId, email: session.email, features: session.features ?? [] };
}
