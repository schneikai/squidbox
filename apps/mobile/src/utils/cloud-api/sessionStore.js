import { deleteItemAsync, getItemAsync, setItemAsync } from './secureStorage';

import { createPersistedStore } from '@/utils/persistedStore';

/** @typedef {import('@/library/session').Session} Session */

// The one session record: who is signed in, on which server, obtained from which base URL, and the
// tokens (null once the server rejected them and the user has to sign in again).
const SESSION_KEY = 'session';

const store = createPersistedStore({
  name: 'The session',
  write: (session) => (session ? setItemAsync(SESSION_KEY, JSON.stringify(session)) : deleteItemAsync(SESSION_KEY)),
});

export const getSession = store.get;
export const getSessionSnapshot = store.snapshot;
export const onSessionChange = store.subscribe;
export const updateSession = store.update;

/** Boot: reads the stored session. */
export function loadSessionAsync() {
  return store.load(async () => {
    const stored = await getItemAsync(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  });
}

/**
 * Signs out, or records a session the server rejected: the tokens go, the session keeps its owner
 * (so its library stays open). Resolves the dropped tokens, for the caller to revoke, null when
 * there were none.
 * @returns {Promise<Session['tokens']>}
 */
export async function dropTokensAsync() {
  let dropped = null;
  await updateSession((current) => {
    dropped = current?.tokens ?? null;
    return dropped ? { ...current, tokens: null } : current;
  });
  return dropped;
}
