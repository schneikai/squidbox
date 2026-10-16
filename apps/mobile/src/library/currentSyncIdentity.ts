import { openLibraryEntry } from './current';
import { isSessionAuthenticated, type SyncIdentity } from './sessionMatches';

import sessionIdentity from '@/utils/cloud-api/sessionIdentity';
import { getSession } from '@/utils/cloud-api/sessionStore';

// The identity of a sync or backup run started now: the open library with the stored session, or
// null when nothing may sync: the device library, a signed-out, expired or unverified session, or a
// session for someone else.
export function currentSyncIdentity(): SyncIdentity | null {
  const library = openLibraryEntry();
  const session = getSession();
  return library && isSessionAuthenticated(library, session) ? (sessionIdentity(session) as SyncIdentity) : null;
}
