import getUserAsync from './user/getUserAsync';
import setUserAsync from './user/setUserAsync';

import { getAccessTokenAsync, clearTokensAsync } from '@/utils/cloud-api/apiTokenStore';
import getApiUserAsync from '@/utils/cloud-api/user/getUserAsync';

export default async function initializeCloudAsync() {
  // We need api token and user data to initialize the cloud state.
  // This is necessary since we store them separately (SecureStore for tokens, AsyncStorage for user data).
  const token = await getAccessTokenAsync();
  let user = await getUserAsync();

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
