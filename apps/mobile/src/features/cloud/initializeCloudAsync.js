import api from '@/utils/cloud-api/api';
import { API_BASE_URL, SERVER_URL } from '@/utils/cloud-api/apiBaseUrl';
import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';
import { getSessionAsync, setSessionAsync } from '@/utils/cloud-api/sessionStore';

// Resolves the stored session for this launch and returns it. A complete session obtained from the
// current base URL is good as it is, offline included. A changed base URL (a new dev tunnel) must
// first prove it is the session's server: its /up has to report the session's serverId, then the
// session rebinds to it; another server's tokens are dropped. A session missing its owner (a
// converted install) is filled from /me. Only the server's own "no" (401/403) drops tokens; a
// network error leaves everything for the next launch.
export default async function initializeCloudAsync() {
  let session = await getSessionAsync();
  if (!session?.tokens) return session;

  if (session.apiBaseUrl !== API_BASE_URL) {
    const serverId = await fetchServerIdAsync();
    if (serverId === undefined) return session;
    if (serverId === null || serverId !== session.serverId) return dropTokensAsync(session);
    session = { ...session, apiBaseUrl: API_BASE_URL };
    await setSessionAsync(session);
  }

  if (session.serverId && session.userId && session.email) return session;
  return fillOwnerAsync(session);
}

// The server's identity (null before its SERVER_ID deploy), or undefined when it can't be reached.
async function fetchServerIdAsync() {
  try {
    const { data } = await api.get(`${SERVER_URL}/up`);
    return data.serverId ?? null;
  } catch {
    return undefined;
  }
}

async function fillOwnerAsync(session) {
  try {
    const {
      data: { user, serverId },
    } = await apiWithAuthentication.get('me');
    const filled = { ...session, serverId: serverId ?? null, userId: user.id, email: user.email };
    await setSessionAsync(filled);
    return filled;
  } catch (error) {
    if ([401, 403].includes(error?.response?.status)) return dropTokensAsync(await getSessionAsync());
    return session;
  }
}

async function dropTokensAsync(session) {
  if (!session?.tokens) return session;
  const dropped = { ...session, tokens: null };
  await setSessionAsync(dropped);
  return dropped;
}
