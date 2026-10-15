import api from '../api';

// Revokes this device's refresh token, best effort: the session is already gone locally, and the
// route needs no access token, so a failure (offline, a token the server no longer knows) changes
// nothing for the user.
export default async function logoutAsync(refreshToken) {
  try {
    await api.post('auth/logout', { refreshToken });
  } catch {}
}
