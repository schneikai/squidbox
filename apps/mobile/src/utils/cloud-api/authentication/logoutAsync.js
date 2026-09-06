import { clearTokensAsync, getRefreshTokenAsync } from '../apiTokenStore';
import apiWithAuthentication from '../apiWithAuthentication';

export default async function logoutAsync() {
  // Always logout even if api communication fails.
  // We also use this behavior in CloudProvider#logoutAsync
  try {
    // New backend revokes THIS device's refresh token (per-device token table).
    const refreshToken = await getRefreshTokenAsync();
    await apiWithAuthentication.post('auth/logout', { refreshToken });
  } finally {
    await clearTokensAsync();
  }
}
