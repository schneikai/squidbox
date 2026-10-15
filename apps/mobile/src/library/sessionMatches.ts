import type { Library } from './registry';
import type { Session } from './session';

// What a sync run and every request of it belong to.
export interface SyncIdentity {
  libraryId: string;
  serverId: string | null;
  userId: string;
}

// Whether the session belongs to the library's owner. A null serverId on either side is one not
// resolved yet (a converted install before its first /me), never a different server.
export function sessionMatches(library: Library, session: Session | null): boolean {
  const { owner } = library;
  if (owner.kind !== 'account' || !session?.userId) return false;
  if (owner.userId !== session.userId) return false;
  return owner.serverId === session.serverId || owner.serverId === null || session.serverId === null;
}

// Signed in for this library: the session has tokens obtained from the current base URL (a changed
// one is verified and rebound first, initializeCloudAsync) and it is the library owner's.
export function isSessionAuthenticated(library: Library, session: Session | null, apiBaseUrl: string): boolean {
  return Boolean(session?.tokens) && session!.apiBaseUrl === apiBaseUrl && sessionMatches(library, session);
}

// The identity a sync run of this library would have, or null when nothing may sync: the device
// library, a signed-out, expired or unverified session, or a session for someone else.
export function syncIdentity(library: Library, session: Session | null, apiBaseUrl: string): SyncIdentity | null {
  if (!isSessionAuthenticated(library, session, apiBaseUrl)) return null;
  return { libraryId: library.id, serverId: session!.serverId, userId: session!.userId! };
}
