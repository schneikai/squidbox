import type { UpResponse } from '@squidbox/shared';

import api from './api';
import { API_BASE_URL, SERVER_URL } from './apiBaseUrl';
import { dropTokensAsync, getSession, updateSession } from './sessionStore';

// Verifies the stored session for this launch: a changed base URL (a new dev tunnel) must report the
// session's serverId in /up before the session rebinds to it, else the tokens are dropped. A network
// error leaves everything for the next launch.
export default async function initializeCloudAsync(): Promise<void> {
  const session = getSession();
  const apiBaseUrl = API_BASE_URL; // a local, so the callback below keeps its narrowing
  if (!apiBaseUrl || !session?.tokens || session.apiBaseUrl === apiBaseUrl) return;

  const serverId = await fetchServerIdAsync();
  if (serverId === undefined) return;
  if (serverId !== session.serverId) await dropTokensAsync();
  else await updateSession((current) => (current ? { ...current, apiBaseUrl } : current));
}

// The server's identity (null from a server too old to report one), or undefined when it can't be reached.
async function fetchServerIdAsync(): Promise<string | null | undefined> {
  try {
    const { data } = await api.get<UpResponse>(`${SERVER_URL}/up`);
    return data.serverId ?? null;
  } catch {
    return undefined;
  }
}
