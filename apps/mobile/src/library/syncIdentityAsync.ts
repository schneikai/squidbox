import { getLibrary, isLibraryOpen } from './current';
import { getRegistry } from './registry';
import type { Session } from './session';
import { syncIdentity, type SyncIdentity } from './sessionMatches';

import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';
import { getSessionAsync } from '@/utils/cloud-api/sessionStore';

// The identity of a sync run started now: the open library with the stored session, or null when
// nothing may sync (sessionMatches.ts).
export async function syncIdentityAsync(): Promise<SyncIdentity | null> {
  if (!isLibraryOpen()) return null;
  const library = getRegistry().libraries.find(({ id }) => id === getLibrary().id);
  if (!library) return null;
  const session = (await getSessionAsync()) as Session | null;
  return syncIdentity(library, session, API_BASE_URL);
}
