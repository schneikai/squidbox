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
    // isAuthenticated must be present before we set it, and unset before we null the user, or the UI
    // reads a null user. On sign-in, wipe the local slate for a DIFFERENT account BEFORE exposing the
    // session, so the gate never renders the previous user's library under the new user (no-op for
    // the same user; holds the sync single-flight so no in-flight pull races the wipe).
    if (user) {
      await runResetSyncForUser(user.id);
      setUser(user);
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      setUser(null);
      // Logout keeps the local library intact (it's the same user's data on their device); it's only
      // wiped when a DIFFERENT account signs in — see runResetSyncForUser above.
    }
    await setUserAsync(user);

    // Kick a mid-session sign-in immediately (cold start's launch pull is handled in App.js once init
    // finishes). No-op until sync is enabled, so this never fires before init.
    if (user) requestSync();
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
