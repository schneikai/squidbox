import api from '../api';
import { API_BASE_URL } from '../apiBaseUrl';
import { updateSession } from '../sessionStore';

// Signs in and stores the session the server answered with. A server without an identity yet
// (before its SERVER_ID deploy) leaves serverId null until /me reports it.
export default async function loginAsync(email, password) {
  const {
    data: { accessToken, refreshToken, user, serverId },
  } = await api.post('auth/login', { email, password });
  return updateSession(() => ({
    serverId: serverId ?? null,
    userId: user.id,
    email: user.email,
    apiBaseUrl: API_BASE_URL,
    tokens: { accessToken, refreshToken },
  }));
}
