import { openLibraryId } from './current';
import { getRegistry } from './registry';
import { syncIdentity, type SyncIdentity } from './sessionMatches';

import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';
import { getSession } from '@/utils/cloud-api/sessionStore';

// The identity of a sync run started now: the open library with the stored session, or null when
// nothing may sync (sessionMatches.ts).
export function currentSyncIdentity(): SyncIdentity | null {
  const library = getRegistry().libraries.find(({ id }) => id === openLibraryId());
  return library ? syncIdentity(library, getSession(), API_BASE_URL) : null;
}
