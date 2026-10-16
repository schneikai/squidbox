import { openLibraryId } from './current';
import { mergeLibrary } from './mergeRun';
import { deviceLibrary, getRegistry, updateLibrary, type Library } from './registry';
import { sameAccount } from './sameAccount';
import type { Session } from './session';
import { sessionMatches } from './sessionMatches';

import { getDb } from '@/sync/db/client';
import { setOwner } from '@/sync/status';
import { getSession, updateSession } from '@/utils/cloud-api/sessionStore';
import getNewItemId from '@/utils/getNewItemId';

// The session is the open pointer: no session means this device's library, a session its owner's
// (both created when missing, by the switch), with or without tokens: a signed-out or expired
// session keeps its owner, so the library stays open. A session that doesn't know its user yet (a
// converted install before its first /me) opens the one library whose server is unresolved, else
// this device's until /me says whose it is.
export function libraryForSession(session: Session | null): Library {
  const { libraries } = getRegistry();
  if (session) {
    const existing = libraries.find(
      ({ owner }) =>
        owner.kind === 'account' && (session.userId === null ? owner.serverId === null : sameAccount(owner, session)),
    );
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
  if (openLibraryId() !== target.id) {
    try {
      await switchLibrary(target);
    } catch (error) {
      await updateSession(() => previous);
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
  await updateLibrary(library.id, (entry) => ({ ...entry, owner: resolved }));
}

// A sign-in (the session just stored): the account's library opens, then whatever this device's
// library holds (added before any sign-in) joins it, crash-safe (mergeRun.ts), and pushes with the
// next sync. A merge that fails doesn't fail the sign-in: the device library stays parked and the
// next sign-in tries again.
export async function openLibraryForSignIn(
  session: Session,
  previous: Session | null,
  switchLibrary: (target: Library) => Promise<void>,
): Promise<void> {
  await openLibraryForSession(session, previous, switchLibrary);
  const source = deviceLibrary(getRegistry().libraries);
  const targetId = openLibraryId();
  if (!source || targetId === null || source.id === targetId) return;
  try {
    await mergeLibrary(source.id, targetId);
  } catch (error) {
    console.warn('Could not add this device’s library to the account', error);
  }
}

// A sign-out keeps the library open: only the tokens go (returned, for the caller to revoke), the
// session keeps its owner, so the same library is open now and at the next boot, nothing syncs until
// the owner signs in again (needsReauth), and what is added meanwhile uploads then.
export async function signOut(): Promise<Session['tokens']> {
  const tokens = getSession()?.tokens ?? null;
  await updateSession((session) => (session?.tokens ? { ...session, tokens: null } : session));
  return tokens;
}

// The boot's open: the stored session's library, then the owner resolved from the session once
// the cloud init verified it (a converted session that learned its user from /me may name another
// library than the one opened first; the switch then moves there).
export async function openLibraryForBoot(
  verified: Promise<Session | null>,
  switchLibrary: (target: Library) => Promise<void>,
  session: Session | null,
): Promise<void> {
  await openLibraryForSession(session, session, switchLibrary);
  const checked = await verified;
  await openLibraryForSession(checked, checked, switchLibrary);
}
