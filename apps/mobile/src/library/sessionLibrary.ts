import { openLibraryEntry, openLibraryId } from './current';
import { databaseExists } from './fs';
import { libraryPaths } from './libraryPaths';
import { mergeLibrary, resumeMerges } from './mergeRun';
import { deviceLibrary, getRegistry, type Library } from './registry';
import { sameAccount } from './sameAccount';
import type { Session } from './session';
import { sessionMatches } from './sessionMatches';
import { withLibraryDb } from './withLibraryDb';

import { isFirstSyncDone } from '@/sync/status';
import { withSyncPaused } from '@/sync/worker';
import { dropTokensAsync, getSession, onSessionChange, updateSession } from '@/utils/cloud-api/sessionStore';
import getNewItemId from '@/utils/getNewItemId';

type SwitchLibrary = (target: Library) => Promise<void>;

// The session's own library: no session means this device's library, a session its owner's (both
// created when missing, by the switch), with or without tokens. Which one opens is libraryToOpen's.
export function libraryForSession(session: Session | null): Library {
  const { libraries } = getRegistry();
  if (!session) return deviceLibrary(libraries) ?? { id: getNewItemId(), owner: { kind: 'device' } };
  const existing = libraries.find((library) => sessionMatches(library, session));
  if (existing) return existing;
  const { serverId, userId, email } = session;
  return { id: getNewItemId(), owner: { kind: 'account', serverId, userId, email: email ?? '' } };
}

// Whether this device's library waits to join `target`, by the list (which follows the device
// library's own database, mergeRun.ts): `target` is an account library of the account the device
// library may join (any, until a merge pass recorded one, mergeMarker.ts), and the device library
// isn't kept for a library or merging into another one still listed.
function waitsToJoin(device: Library | undefined, target: Library): device is Library {
  if (!device || device.id === target.id || device.keptFor || target.owner.kind !== 'account') return false;
  const marker = device.mergedInto;
  if (!marker) return true;
  const listed = getRegistry().libraries.some(({ id }) => id === marker.library);
  return sameAccount(marker, target.owner) && (marker.library === target.id || !listed);
}

// At boot, and whenever the tokens go (openLibraryForSignOut): opens libraryToOpen, switching when
// another library is open. One that won't open gives way to the session's own library, so a damaged
// device library never keeps the app from booting or the user from signing in.
export async function openLibraryForSession(session: Session | null, switchLibrary: SwitchLibrary): Promise<void> {
  const target = await libraryToOpen(session);
  if (openLibraryId() === target.id) return;
  try {
    await switchLibrary(target);
  } catch (error) {
    const own = libraryForSession(session);
    if (own.id === target.id) throw error;
    console.warn(`Could not open library ${target.id}; opening the session's own`, error);
    if (openLibraryId() !== own.id) await switchLibrary(own);
  }
}

// The session's own library, unless it would hide this iPhone's photos: while the session can't
// pull (no tokens: signed out, or the server wants a new sign-in) and its account library hasn't
// finished its first full pull, which this device's library waits to join (every merge waits for
// it, mergeWaits), this device's library stays open, until a sign-in lets the pull and the merge run.
async function libraryToOpen(session: Session | null): Promise<Library> {
  const own = libraryForSession(session);
  const device = deviceLibrary(getRegistry().libraries);
  if (!session || session.tokens || !waitsToJoin(device, own)) return own;
  return (await hasPulled(own)) ? own : device;
}

// Whether the library's first full pull has drained; a library without a database hasn't pulled.
async function hasPulled(library: Library): Promise<boolean> {
  if (library.id !== openLibraryId() && !(await databaseExists(libraryPaths(library.id).dbName))) return false;
  return withLibraryDb(library.id, isFirstSyncDone);
}

// A sign-in, inside the caller's paused sync section: the account's library opens, then the session
// is stored (so nothing ever sees a session whose library isn't open), then the merges due run: one
// already marked for that library resumes, and whatever this device's library holds joins it. A
// switch that fails leaves the previous session and library as they were. Resolves whether it
// switched libraries.
export async function openLibraryForSignIn(session: Session, switchLibrary: SwitchLibrary): Promise<boolean> {
  const target = libraryForSession(session);
  const switched = openLibraryId() !== target.id;
  if (switched) await switchLibrary(target);
  await updateSession(() => session);
  await mergesDue();
  return switched;
}

// A sign-out, or any other loss of the tokens, inside the caller's paused sync section: the tokens go
// (if still there), and libraryToOpen opens. Resolves the dropped tokens, for the caller to revoke.
export async function openLibraryForSignOut(switchLibrary: SwitchLibrary): Promise<Session['tokens']> {
  const dropped = await dropTokensAsync();
  await openLibraryForSession(getSession(), switchLibrary);
  return dropped;
}

// Tokens that go anywhere else (the server rejecting a refresh, inside a sync run; a changed server
// at the cloud init) run openLibraryForSignOut too, in a paused section of their own, started
// outside the code that dropped them (a sync run can't wait for a pause). Returns the unsubscribe.
export function watchTokenDrops(switchLibrary: SwitchLibrary): () => void {
  let hadTokens = Boolean(getSession()?.tokens);
  return onSessionChange((session) => {
    const dropped = hadTokens && session !== null && !session.tokens;
    hadTokens = Boolean(session?.tokens);
    if (!dropped) return;
    withSyncPaused(() => openLibraryForSignOut(switchLibrary)).catch((error) =>
      console.warn('Could not open the library for a session without tokens', error),
    );
  });
}

// This device's library when it waits to join the open library (waitsToJoin), its owner's account
// library. One already marked for it counts (it waits for that library's first pull).
export function deviceLibraryToJoin(): Library | null {
  const source = deviceLibrary(getRegistry().libraries);
  const target = openLibraryEntry();
  if (!target || !sessionMatches(target, getSession()) || !waitsToJoin(source, target)) return null;
  return source;
}

// Whatever this device's library holds (added before any sign-in) joins the open library when that
// is its owner's account library: at the sign-in, at every boot and at the end of the open library's
// first full pull (runPendingMerges), so a merge that waited or failed is tried again (mergeRun.ts,
// crash-safe and idempotent). One marked for a library still listed is resumeMerges', so a boot never
// runs a merge twice. A failure doesn't fail the sign-in or the boot: the device library stays
// parked until the next try.
export async function mergeDeviceLibrary(): Promise<void> {
  const source = deviceLibraryToJoin();
  const marker = source?.mergedInto;
  if (!source || (marker && getRegistry().libraries.some(({ id }) => id === marker.library))) return;
  try {
    await mergeLibrary(source.id, openLibraryEntry()!.id);
  } catch (error) {
    console.warn('Could not add this device’s library to the account', error);
  }
}

// Every merge due: those a crash or a failure interrupted (resumeMerges), then this device's library.
async function mergesDue(): Promise<void> {
  await resumeMerges();
  await mergeDeviceLibrary();
}

// mergesDue, serialized with every switch and sync run: at the boot, and when the open library's
// first full pull drains (useMergeAfterFirstSync), as every merge waits for it.
export function runPendingMerges(): Promise<void> {
  return withSyncPaused(mergesDue);
}
