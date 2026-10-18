import type { Library } from './registry';
import { sameAccount } from './sameAccount';
import type { Session } from './session';

import { API_BASE_URL } from '@/utils/cloud-api/apiBaseUrl';

// What a sync run and every request of it belong to.
export interface SyncIdentity {
  serverId: string;
  userId: string;
}

// Whether the session belongs to the library's owner.
export function sessionMatches(library: Library, session: Session | null): boolean {
  return library.owner.kind === 'account' && session !== null && sameAccount(library.owner, session);
}

// Signed in for this library: the session has tokens obtained from the current base URL (a changed
// one is verified and rebound first, initializeCloudAsync) and it is the library owner's.
export function isSessionAuthenticated(library: Library, session: Session | null): boolean {
  return Boolean(session?.tokens) && session!.apiBaseUrl === API_BASE_URL && sessionMatches(library, session);
}

// The owner's session is there but the server rejected its tokens: the library stays open and
// editable, nothing syncs until the owner signs in again.
export function needsReauth(library: Library, session: Session | null): boolean {
  return session !== null && session.tokens === null && sessionMatches(library, session);
}
