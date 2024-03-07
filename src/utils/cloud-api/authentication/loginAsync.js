import api from '../api';
import { setAccessTokenAsync, setRefreshTokenAsync, clearTokensAsync } from '../apiTokenStore';

export default async function loginAsync(email, password) {
  try {
    const {
      data: { accessToken, refreshToken, user },
    } = await api.post('auth/login', {
      email,
      password,
    });
    await setAccessTokenAsync(accessToken);
    await setRefreshTokenAsync(refreshToken);
    return user;
  } catch (error) {
    await clearTokensAsync();
    throw error;
  }
}
