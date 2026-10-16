import api from './api';
import { API_BASE_URL, SERVER_URL } from './apiBaseUrl';
import apiWithAuthentication from './apiWithAuthentication';
import { dropTokensAsync, getSession, updateSession } from './sessionStore';

// Verifies the stored session for this launch and resolves to it. A complete session obtained from
// the current base URL is good as it is, offline included. A changed base URL (a new dev tunnel)
// must first prove it is the session's server: its /up has to report the session's serverId, then
// the session rebinds to it; another server's tokens are dropped. A session missing its owner (a
// converted install) is filled from /me. Only the server's own "no" (401/403) drops tokens; a
// network error leaves everything for the next launch. Every change goes through updateSession, so
// tokens a refresh rotates meanwhile are never overwritten.
export default async function initializeCloudAsync() {
  const session = getSession();
  if (!session?.tokens) return session;

  if (session.apiBaseUrl !== API_BASE_URL) {
    const serverId = await fetchServerIdAsync();
    if (serverId === undefined) return session;
    if (serverId === null || serverId !== session.serverId) return dropAsync();
    await updateSession((current) => (current ? { ...current, apiBaseUrl: API_BASE_URL } : current));
  }

  if (session.serverId && session.userId && session.email) return getSession();
  return fillOwnerAsync();
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

async function fillOwnerAsync() {
  try {
    const {
      data: { user, serverId },
    } = await apiWithAuthentication.get('me');
    return updateSession((current) =>
      current ? { ...current, serverId: serverId ?? null, userId: user.id, email: user.email } : current,
    );
  } catch (error) {
    if ([401, 403].includes(error?.response?.status)) return dropAsync();
    return getSession();
  }
}

async function dropAsync() {
  await dropTokensAsync();
  return getSession();
}
