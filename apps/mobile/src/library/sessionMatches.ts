import type { Library } from './registry';
import { sameAccount } from './sameAccount';
import type { Session } from './session';

import sessionIdentity from '@/utils/cloud-api/sessionIdentity';

// What a sync run and every request of it belong to.
export interface SyncIdentity {
  serverId: string | null;
  userId: string;
}

// Whether the session belongs to the library's owner.
export function sessionMatches(library: Library, session: Session | null): boolean {
  return library.owner.kind === 'account' && session !== null && sameAccount(library.owner, session);
}

// Signed in for this library: the session has tokens obtained from the current base URL (a changed
// one is verified and rebound first, initializeCloudAsync) and it is the library owner's.
export function isSessionAuthenticated(library: Library, session: Session | null, apiBaseUrl: string): boolean {
  return Boolean(session?.tokens) && session!.apiBaseUrl === apiBaseUrl && sessionMatches(library, session);
}

// The owner's session is there but the server rejected its tokens: the library stays open and
// editable, nothing syncs until the owner signs in again.
export function needsReauth(library: Library, session: Session | null): boolean {
  return session !== null && session.tokens === null && sessionMatches(library, session);
}

// The identity a sync run of this library would have, or null when nothing may sync: the device
// library, a signed-out, expired or unverified session, or a session for someone else.
export function syncIdentity(library: Library, session: Session | null, apiBaseUrl: string): SyncIdentity | null {
  return isSessionAuthenticated(library, session, apiBaseUrl) ? (sessionIdentity(session) as SyncIdentity) : null;
}
