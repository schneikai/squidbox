import { getLibrary, isLibraryOpen } from './current';
import { deviceLibrary, findAccountLibrary, getRegistry, setLibraryOwner, type Library } from './registry';
import type { Session } from './session';
import { sessionMatches } from './sessionMatches';

import { getDb } from '@/sync/db/client';
import { setOwner } from '@/sync/status';
import { setSessionAsync } from '@/utils/cloud-api/sessionStore';
import getNewItemId from '@/utils/getNewItemId';

// The session is the open pointer: no session means this device's library, a session its owner's
// (both created when missing, by the switch). A session that doesn't know its user yet (a
// converted install before its first /me) opens the one library whose server is unresolved, else
// this device's until /me says whose it is.
export function libraryForSession(session: Session | null): Library {
  const { libraries } = getRegistry();
  if (session) {
    const existing = findAccountLibrary(libraries, session.serverId, session.userId);
    if (existing) return existing;
    if (session.userId) {
      const { serverId, userId, email } = session;
      return { id: getNewItemId(), owner: { kind: 'account', serverId, userId, email: email ?? '' } };
    }
  }
  return deviceLibrary(libraries) ?? { id: getNewItemId(), owner: { kind: 'device' } };
}

// The stored session has just become `session`: opens its library, switching when another one is
// open. When the switch fails, `previous` is stored again (its library is open again) and the error
// rethrown. A library whose owner was unresolved learns the session's serverId and email.
export async function openLibraryForSession(
  session: Session | null,
  previous: Session | null,
  switchLibrary: (target: Library) => Promise<void>,
): Promise<void> {
  const target = libraryForSession(session);
  if (!isLibraryOpen() || getLibrary().id !== target.id) {
    try {
      await switchLibrary(target);
    } catch (error) {
      await setSessionAsync(previous);
      throw error;
    }
  }
  await resolveOwner(target, session);
}

async function resolveOwner(library: Library, session: Session | null): Promise<void> {
  const { owner } = library;
  if (owner.kind !== 'account' || !sessionMatches(library, session)) return;
  const resolved = {
    ...owner,
    serverId: owner.serverId ?? session!.serverId,
    email: owner.email || session!.email || '',
  };
  if (resolved.serverId === owner.serverId && resolved.email === owner.email) return;
  await setOwner(getDb(), resolved);
  await setLibraryOwner(library.id, resolved);
}
