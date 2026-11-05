import { deleteItemAsync, getItemAsync, setItemAsync } from './secureStorage';

import type { Session } from '@/library/session';
import { createPersistedStore } from '@/utils/persistedStore';

// The one session record: who is signed in, on which server, obtained from which base URL, and the
// tokens (null once the server rejected them and the user has to sign in again).
const SESSION_KEY = 'session';

const store = createPersistedStore<Session | null>({
  name: 'The session',
  write: (session) => (session ? setItemAsync(SESSION_KEY, JSON.stringify(session)) : deleteItemAsync(SESSION_KEY)),
});

export const getSession = store.get;
export const getSessionSnapshot = store.snapshot;
export const onSessionChange = store.subscribe;
export const updateSession = store.update;

/** Boot: reads the stored session. */
export function loadSessionAsync(): Promise<Session | null> {
  return store.load(async () => {
    const stored = await getItemAsync(SESSION_KEY);
    // Written only by this store (`write` above), so it is a Session.
    return stored ? (JSON.parse(stored) as Session) : null;
  });
}

/**
 * Signs out, or records a session the server rejected: the tokens go, the session keeps its owner
 * (which library opens then is libraryToOpen's, library/sessionLibrary.ts). Resolves the dropped
 * tokens, for the caller to revoke, null when there were none.
 */
export async function dropTokensAsync(): Promise<Session['tokens']> {
  let dropped: Session['tokens'] = null;
  await updateSession((current) => {
    dropped = current?.tokens ?? null;
    return current && dropped ? { ...current, tokens: null } : current;
  });
  return dropped;
}
