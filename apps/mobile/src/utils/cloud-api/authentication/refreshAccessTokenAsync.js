import api from '../api';
import { clearTokensAsync, getRefreshTokenAsync, setAccessTokenAsync, setRefreshTokenAsync } from '../apiTokenStore';
import { notifySessionExpired } from '../sessionExpiry';

let inFlightRefresh = null;

// Refresh the session once for every concurrent caller. The server rotates refresh tokens, so a
// second parallel refresh with the same token would be rejected and sign the user out.
export default function refreshAccessTokenAsync() {
  inFlightRefresh ??= refreshOnceAsync().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function refreshOnceAsync() {
  const refreshToken = await getRefreshTokenAsync();
  if (!refreshToken) throw new Error('No session to refresh');

  try {
    const { data } = await api.post('auth/refresh', { refreshToken });
    await setAccessTokenAsync(data.accessToken);
    await setRefreshTokenAsync(data.refreshToken);
    return data.accessToken;
  } catch (error) {
    if (isRejectedByServer(error)) await expireSessionAsync(refreshToken);
    throw error;
  }
}

// Only a definitive "no" from the server ends the session. Network errors and rate limits keep it,
// so being offline when the access token expires doesn't sign the user out.
function isRejectedByServer(error) {
  return [400, 401, 403].includes(error?.response?.status);
}

async function expireSessionAsync(rejectedRefreshToken) {
  // A newer sign-in may have replaced the session while this refresh was in flight.
  if ((await getRefreshTokenAsync()) !== rejectedRefreshToken) return;
  await clearTokensAsync();
  notifySessionExpired();
}
