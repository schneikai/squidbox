import { useState } from 'react';

import CloudContext from './CloudContext';
import downloadAssetFileAsync from './assets/downloadAssetFileAsync';
import preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';
import uploadAssetFileAsync from './assets/uploadAssetFileAsync';
import uploadAssetThumbnailAsync from './assets/uploadAssetThumbnailAsync';
import backupDataAsync from './data/backupDataAsync';
import loadDataAndSaveLocalAsync from './data/loadDataAndSaveLocalAsync';
import initializeCloudAsyncFn from './initializeCloudAsync';

import setUserAsync from '@/features/cloud/user/setUserAsync';
import apiLoginAsync from '@/utils/cloud-api/authentication/loginAsync';
import apiLogoutAsync from '@/utils/cloud-api/authentication/logoutAsync';
import deleteLocalDataAsync from '@/utils/local-data/deleteLocalDataAsync';
import useInitializeLocalData from '@/utils/local-data/useInitializeLocalData';

export default function CloudProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const initializeLocalDataAsync = useInitializeLocalData();

  // TODO: Added this flag to prevent accidental data loss during development
  // until we have a way to detect and keep unsynced data on logout.
  // This flag should always be true in production though!
  const CLEAR_DATA_BETWEEN_LOGINS = false;

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
    await initializeLocalDataAsync();
    await setUserAsync(user);
  }

  const value = {
    isAuthenticated,
    user,
    initializeCloudAsync: async () => {
      const user = await initializeCloudAsyncFn();
      await updateUserAuthenticationStatusAsync(user);
    },
    loginAsync: async (email, password) => {
      try {
        const user = await apiLoginAsync(email, password);
        if (CLEAR_DATA_BETWEEN_LOGINS) {
          await deleteLocalDataAsync();
          await loadDataAndSaveLocalAsync();
        }
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
    loadDataAndSaveLocalAsync,
    backupDataAsync,
    preloadAssetThumbnailsAsync,
    uploadAssetFileAsync,
    uploadAssetThumbnailAsync,
    downloadAssetFileAsync,
  };

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}
