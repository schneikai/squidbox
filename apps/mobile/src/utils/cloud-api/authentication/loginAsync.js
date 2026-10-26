import api from '../api';
import { API_BASE_URL } from '../apiBaseUrl';

// Signs in and resolves the session the server answered with; the caller stores it once its
// library is open.
export default async function loginAsync(email, password) {
  const {
    data: { accessToken, refreshToken, user, serverId },
  } = await api.post('auth/login', { email, password });
  return {
    serverId,
    userId: user.id,
    email: user.email,
    features: user.features ?? [],
    apiBaseUrl: API_BASE_URL,
    tokens: { accessToken, refreshToken },
  };
}
