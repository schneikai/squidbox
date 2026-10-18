import api from './api';
import { API_BASE_URL, SERVER_URL } from './apiBaseUrl';
import { dropTokensAsync, getSession, updateSession } from './sessionStore';

// Verifies the stored session for this launch: a changed base URL (a new dev tunnel) must report the
// session's serverId in /up before the session rebinds to it, else the tokens are dropped. A network
// error leaves everything for the next launch.
export default async function initializeCloudAsync() {
  const session = getSession();
  if (!session?.tokens || session.apiBaseUrl === API_BASE_URL) return;

  const serverId = await fetchServerIdAsync();
  if (serverId === undefined) return;
  if (serverId !== session.serverId) await dropTokensAsync();
  else await updateSession((current) => (current ? { ...current, apiBaseUrl: API_BASE_URL } : current));
}

// The server's identity (null when it reports none), or undefined when it can't be reached.
async function fetchServerIdAsync() {
  try {
    const { data } = await api.get(`${SERVER_URL}/up`);
    return data.serverId ?? null;
  } catch {
    return undefined;
  }
}
