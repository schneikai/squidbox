import api from '../api';
import { setAccessTokenAsync, setRefreshTokenAsync, clearTokensAsync } from '../apiTokenStore';

export default async function refreshAccessTokenAsync(refreshToken) {
  try {
    const response = await api.post('auth/refresh', {
      refreshToken,
    });
    const { accessToken, refreshToken: newRefreshToken } = response.data;
    await setAccessTokenAsync(accessToken);
    await setRefreshTokenAsync(newRefreshToken);
    return accessToken;
  } catch (error) {
    await clearTokensAsync();
    throw error;
  }
}
