import { useState, useMemo } from 'react';

import CloudContext from './CloudContext';
import downloadAssetFileAsync from './assets/downloadAssetFileAsync';
import preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';
import uploadAssetFileAsync from './assets/uploadAssetFileAsync';
import uploadAssetThumbnailAsync from './assets/uploadAssetThumbnailAsync';
import initializeCloudAsyncFn from './initializeCloudAsync';

import { CLEAR_DATA_BETWEEN_LOGINS } from '@/constants';
import setUserAsync from '@/features/cloud/user/setUserAsync';
import { requestSync } from '@/sync/worker';
import apiLoginAsync from '@/utils/cloud-api/authentication/loginAsync';
import apiLogoutAsync from '@/utils/cloud-api/authentication/logoutAsync';
import deleteLocalDataAsync from '@/utils/local-data/deleteLocalDataAsync';

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

      // TODO: It is very important that we add code to keep unsynced
      // local data on the device when logging out or it will be lost forever.
      // Logout can happen if the user explicitly logs out and in that case
      // we can warn about the loss of data but the logout might also
      // happen unintentionally if api tokens have expired or there was
      // some other problem during cloud initialization.

      // If there is no user we need to delete all local data.
      if (CLEAR_DATA_BETWEEN_LOGINS) await deleteLocalDataAsync();
    }
    await setUserAsync(user);

    // Kick the sync engine the moment we're authenticated (fresh login OR a restored session), so
    // the first pull starts immediately instead of waiting up to one interval (~30s). Without this
    // the app looks stuck after login — the setup screen sits at 0 until the interval fires.
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
          // The sync engine (src/sync) pulls all data after login; the old JSON snapshot load is gone.
          if (CLEAR_DATA_BETWEEN_LOGINS) await deleteLocalDataAsync();
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
