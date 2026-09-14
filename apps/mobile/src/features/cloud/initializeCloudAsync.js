import getUserAsync from './user/getUserAsync';
import setUserAsync from './user/setUserAsync';

import { getAccessTokenAsync, clearTokensAsync } from '@/utils/cloud-api/apiTokenStore';
import getApiUserAsync from '@/utils/cloud-api/user/getUserAsync';

export default async function initializeCloudAsync() {
  // Token + user are stored separately (SecureStore vs AsyncStorage) and independent — read them in
  // parallel; this is on the splash-blocking init path.
  const [token, storedUser] = await Promise.all([getAccessTokenAsync(), getUserAsync()]);
  let user = storedUser;

  if (token && !user) {
    user = await handleMissingUser();
  } else if (!token && user) {
    await setUserAsync(null);
    user = null;
  }

  return user;
}

// Try to get user from API. If successful, set and return user,
// otherwise delete tokens and return null for user.
async function handleMissingUser() {
  try {
    const apiUser = await getApiUserAsync();
    if (apiUser) {
      await setUserAsync(apiUser);
      return apiUser;
    }
  } catch (error) {
    console.log(`Error getting API user in initializeCloudAsync. Error: ${error.message}`);
  }

  clearTokensAsync();
  return null;
}
