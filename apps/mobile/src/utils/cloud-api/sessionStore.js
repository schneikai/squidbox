import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from './apiBaseUrl';
import { deleteItemAsync, getItemAsync, setItemAsync } from './secureStorage';

// The one session record: who is signed in, on which server, obtained from which base URL, and the
// tokens (null once the server rejected them and the user has to sign in again).
//   { serverId, userId, email, apiBaseUrl, tokens: { accessToken, refreshToken } | null }
// serverId, userId and email can be null until the first /me fills them (a converted install).
const SESSION_KEY = 'session';

// Before the session record, the tokens lived under two keys and the user in AsyncStorage.
const LEGACY_ACCESS_TOKEN_KEY = 'accessToken';
const LEGACY_REFRESH_TOKEN_KEY = 'refreshToken';
const LEGACY_USER_KEY = 'user';

let legacyConverted = false;

export async function getSessionAsync() {
  const stored = await getItemAsync(SESSION_KEY);
  if (stored) return JSON.parse(stored);
  if (legacyConverted) return null;
  legacyConverted = true;
  return convertLegacySessionAsync();
}

export async function setSessionAsync(session) {
  if (session) return setItemAsync(SESSION_KEY, JSON.stringify(session));
  return deleteItemAsync(SESSION_KEY);
}

// Writes the new record first, then removes the old keys, so a crash in between re-runs to the
// same state. The server and base URL the tokens came from are the current ones.
async function convertLegacySessionAsync() {
  const [accessToken, refreshToken, storedUser] = await Promise.all([
    getItemAsync(LEGACY_ACCESS_TOKEN_KEY),
    getItemAsync(LEGACY_REFRESH_TOKEN_KEY),
    AsyncStorage.getItem(LEGACY_USER_KEY),
  ]);
  const user = storedUser ? JSON.parse(storedUser) : null;
  const session =
    accessToken && refreshToken
      ? {
          serverId: null,
          userId: user?.id ?? null,
          email: user?.email ?? null,
          apiBaseUrl: API_BASE_URL,
          tokens: { accessToken, refreshToken },
        }
      : null;
  if (session) await setSessionAsync(session);
  await Promise.all([
    deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY),
    deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY),
    AsyncStorage.removeItem(LEGACY_USER_KEY),
  ]);
  return session;
}
