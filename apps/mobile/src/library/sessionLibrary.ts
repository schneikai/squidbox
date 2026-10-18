import { openLibraryEntry, openLibraryId } from './current';
import { mergeLibrary } from './mergeRun';
import { deviceLibrary, getRegistry, type Library } from './registry';
import { sameAccount } from './sameAccount';
import type { Session } from './session';
import { sessionMatches } from './sessionMatches';

import { getSession, updateSession } from '@/utils/cloud-api/sessionStore';
import getNewItemId from '@/utils/getNewItemId';

// The session is the open pointer: no session means this device's library, a session its owner's
// (both created when missing, by the switch), with or without tokens, so a signed-out or expired
// session keeps its library open.
export function libraryForSession(session: Session | null): Library {
  const { libraries } = getRegistry();
  if (!session) return deviceLibrary(libraries) ?? { id: getNewItemId(), owner: { kind: 'device' } };
  const existing = libraries.find(({ owner }) => owner.kind === 'account' && sameAccount(owner, session));
  if (existing) return existing;
  const { serverId, userId, email } = session;
  return { id: getNewItemId(), owner: { kind: 'account', serverId, userId, email: email ?? '' } };
}

// The stored session has just become `session`: opens its library, switching when another one is
// open.
export async function openLibraryForSession(
  session: Session | null,
  switchLibrary: (target: Library) => Promise<void>,
): Promise<void> {
  const target = libraryForSession(session);
  if (openLibraryId() !== target.id) await switchLibrary(target);
}

// A sign-in, inside the caller's paused sync section: the account's library opens, then the session
// is stored (so nothing ever sees a session whose library isn't open), then whatever this device's
// library holds joins it. A switch that fails leaves the previous session and library as they were.
// Resolves whether it switched libraries.
export async function openLibraryForSignIn(
  session: Session,
  switchLibrary: (target: Library) => Promise<void>,
): Promise<boolean> {
  const target = libraryForSession(session);
  const switched = openLibraryId() !== target.id;
  if (switched) await switchLibrary(target);
  await updateSession(() => session);
  await mergeDeviceLibrary();
  return switched;
}

// Whatever this device's library holds (added before any sign-in) joins the open library when that
// is its owner's account library: at the sign-in and at every boot, so a merge that failed or was
// interrupted is tried again (mergeRun.ts, crash-safe and idempotent). A failure doesn't fail the
// sign-in or the boot: the device library stays parked until the next try.
export async function mergeDeviceLibrary(): Promise<void> {
  const source = deviceLibrary(getRegistry().libraries);
  const target = openLibraryEntry();
  if (!source || source.mergedInto || source.keptFor || !target || !sessionMatches(target, getSession())) return;
  try {
    await mergeLibrary(source.id, target.id);
  } catch (error) {
    console.warn('Could not add this device’s library to the account', error);
  }
}
