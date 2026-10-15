import api from '../api';
import requireSessionAsync, { SessionChangedError } from '../requireSessionAsync';
import { notifySessionExpired } from '../sessionExpiry';
import { getSessionAsync, setSessionAsync } from '../sessionStore';

let inFlightRefresh = null;

// Refresh the session once for every concurrent caller. The server rotates refresh tokens, so a
// second parallel refresh with the same token would be rejected and sign the user out. Refreshes
// only for the identity the caller works for (requireSessionAsync); resolves the new access token.
export default async function refreshAccessTokenAsync(identity) {
  const session = await requireSessionAsync(identity);
  inFlightRefresh ??= refreshOnceAsync(session.tokens.refreshToken).finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function refreshOnceAsync(refreshToken) {
  try {
    const { data } = await api.post('auth/refresh', { refreshToken });
    await writeTokensAsync(refreshToken, { accessToken: data.accessToken, refreshToken: data.refreshToken });
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

// Both tokens in one write, and only into the session that was refreshed: a newer sign-in that
// replaced it meanwhile keeps its own tokens.
async function writeTokensAsync(refreshedToken, tokens) {
  const session = await getSessionAsync();
  if (session?.tokens?.refreshToken !== refreshedToken) throw new SessionChangedError();
  await setSessionAsync({ ...session, tokens });
}

// The server rejected the tokens: the session stays, so the user keeps their library and signs
// in again as its owner, but nothing can sync until then.
async function expireSessionAsync(rejectedRefreshToken) {
  const session = await getSessionAsync();
  if (session?.tokens?.refreshToken !== rejectedRefreshToken) return;
  await setSessionAsync({ ...session, tokens: null });
  notifySessionExpired();
}
