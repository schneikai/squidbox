import { useState, useMemo } from 'react';

import CloudContext from './CloudContext';
import downloadAssetFileAsync from './assets/downloadAssetFileAsync';
import preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';
import uploadAssetFileAsync from './assets/uploadAssetFileAsync';
import uploadAssetThumbnailAsync from './assets/uploadAssetThumbnailAsync';
import initializeCloudAsyncFn from './initializeCloudAsync';

import setUserAsync from '@/features/cloud/user/setUserAsync';
import { requestSync, runResetSyncForUser } from '@/sync/worker';
import apiLoginAsync from '@/utils/cloud-api/authentication/loginAsync';
import apiLogoutAsync from '@/utils/cloud-api/authentication/logoutAsync';

export default function CloudProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  async function updateUserAuthenticationStatusAsync(user) {
    // We need to make sure user is present before setting isAuthenticated
    // and isAuthenticated must be unset before unsetting user.
    // Otherwise we get "cannot read property 'XY' of null" error when
    // trying to access user on the UI.
    if (user) {
      setUser(user);
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      setUser(null);
      // Logout keeps the local library intact (it's the same user's data on their device); it's only
      // wiped when a DIFFERENT account signs in — see runResetSyncForUser below.
    }
    await setUserAsync(user);

    if (user) {
      // If a DIFFERENT account is signing in, wipe the previous user's local data + cursor first, so
      // the new user does a clean first-sync instead of inheriting a stale slate. No-op for the same
      // user (the common case) — their data + cursor stay and sync just resumes.
      await runResetSyncForUser(user.id);
      // Kick the sync engine the moment we're authenticated (fresh login OR a restored session), so
      // the first pull starts immediately instead of waiting up to one interval (~30s). Without this
      // the app looks stuck after login — the setup screen sits at 0 until the interval fires.
      requestSync();
    }
  }

  const value = useMemo(
    () => ({
      isAuthenticated,
      user,
      initializeCloudAsync: async () => {
        const user = await initializeCloudAsyncFn();
        await updateUserAuthenticationStatusAsync(user);
      },
      loginAsync: async (email, password) => {
        try {
          const user = await apiLoginAsync(email, password);
          // The sync engine (src/sync) pulls all data after login; a different account triggers a
          // local reset via updateUserAuthenticationStatusAsync → runResetSyncForUser.
          await updateUserAuthenticationStatusAsync(user);
        } catch (error) {
          await updateUserAuthenticationStatusAsync(null);
          throw error;
        }
      },
      logoutAsync: async () => {
        try {
          await apiLogoutAsync();
        } finally {
          await updateUserAuthenticationStatusAsync(null);
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
