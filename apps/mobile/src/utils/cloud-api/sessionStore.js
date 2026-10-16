import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from './apiBaseUrl';
import { deleteItemAsync, getItemAsync, setItemAsync } from './secureStorage';

/** @typedef {import('@/library/session').Session} Session */

// The one session record: who is signed in, on which server, obtained from which base URL, and the
// tokens (null once the server rejected them and the user has to sign in again). serverId, userId
// and email can be null until the first /me fills them (a converted install). One in-memory copy,
// loaded once at boot and written through, changed only through updateSession on a promise chain,
// so no writer can overwrite another's change from a stale copy.
const SESSION_KEY = 'session';

// Before the session record, the tokens lived under two keys and the user in AsyncStorage.
const LEGACY_ACCESS_TOKEN_KEY = 'accessToken';
const LEGACY_REFRESH_TOKEN_KEY = 'refreshToken';
const LEGACY_USER_KEY = 'user';

/** @type {Session | null | undefined} undefined until loaded */
let session;
let chain = Promise.resolve();
const listeners = new Set();

/** Boot: reads the stored session, converting a legacy install once. @returns {Promise<Session | null>} */
export async function loadSessionAsync() {
  const stored = await getItemAsync(SESSION_KEY);
  session = stored ? JSON.parse(stored) : await convertLegacySessionAsync();
  for (const listener of listeners) listener(session);
  return session;
}

/** @returns {Session | null} */
export function getSession() {
  if (session === undefined) throw new Error('The session is not loaded yet (see LibraryProvider).');
  return session;
}

// Called after every stored change (CloudProvider mirrors the session into React).
export function onSessionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Changes the session: `change` gets the current record and returns the next (the same object
 * for no change). Writes through and notifies.
 * @param {(session: Session | null) => Session | null} change
 * @returns {Promise<Session | null>}
 */
export function updateSession(change) {
  const next = chain.then(async () => {
    const changed = change(getSession());
    if (changed === session) return session;
    session = changed;
    if (session) await setItemAsync(SESSION_KEY, JSON.stringify(session));
    else await deleteItemAsync(SESSION_KEY);
    for (const listener of listeners) listener(session);
    return session;
  });
  chain = next.catch(() => {});
  return next;
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

// Writes the new record first, then removes the old keys, so a crash in between re-runs to the
// same state. Nothing is removed when there is nothing to convert. The server and base URL the
// tokens came from are the current ones.
async function convertLegacySessionAsync() {
  const [accessToken, refreshToken] = await Promise.all([
    getItemAsync(LEGACY_ACCESS_TOKEN_KEY),
    getItemAsync(LEGACY_REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  const storedUser = await AsyncStorage.getItem(LEGACY_USER_KEY);
  const user = storedUser ? JSON.parse(storedUser) : null;
  const converted = {
    serverId: null,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    apiBaseUrl: API_BASE_URL,
    tokens: { accessToken, refreshToken },
  };
  await setItemAsync(SESSION_KEY, JSON.stringify(converted));
  await Promise.all([
    deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY),
    deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY),
    AsyncStorage.removeItem(LEGACY_USER_KEY),
  ]);
  return converted;
}
