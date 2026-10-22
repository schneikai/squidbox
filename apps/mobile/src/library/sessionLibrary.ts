import { openLibraryEntry, openLibraryId } from './current';
import { joinedElsewhere } from './mergeMarker';
import { mergeLibrary, resumeMerges } from './mergeRun';
import { deviceLibrary, getRegistry, isListed, type Library } from './registry';
import type { Session } from './session';
import { sessionMatches } from './sessionMatches';
import { withLibraryDb } from './withLibraryDb';

import { isFirstSyncDone } from '@/sync/status';
import { withSyncPaused } from '@/sync/worker';
import { getSession, onSessionChange, updateSession } from '@/utils/cloud-api/sessionStore';
import getNewItemId from '@/utils/getNewItemId';

export type SwitchLibrary = (target: Library) => Promise<void>;

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

// Whether this device's library waits to join `target`, an account library, by the list (which
// follows the device library's own database, mergeRun.ts): it hasn't joined it yet (a pass committed
// into it: its files are there, only the push is awaited), and its markers keep it from no other
// library (joinedElsewhere).
function waitsToJoin(device: Library | undefined, target: Library): device is Library {
  if (!device || device.id === target.id || target.owner.kind !== 'account') return false;
  if (device.mergedInto?.library === target.id && device.mergedInto.committed) return false;
  return joinedElsewhere(device, target) === null;
}

// At boot and at every loss of the tokens (watchTokenDrops): opens libraryToOpen, switching when
// another library is open. One that won't open gives way to the session's own library, so a damaged
// device library never keeps the app from booting or the user from signing in.
export async function openLibraryForSession(session: Session | null, switchLibrary: SwitchLibrary): Promise<void> {
  const { target, own } = await libraryToOpen(session);
  if (openLibraryId() === target.id) return;
  try {
    await switchLibrary(target);
  } catch (error) {
    if (own.id === target.id) throw error;
    console.warn(`Could not open library ${target.id}; opening the session's own`, error);
    if (openLibraryId() !== own.id) await switchLibrary(own);
  }
}

// The session's own library (`own`), unless it would hide this iPhone's photos: while the session
// can't pull (no tokens: signed out, or the server wants a new sign-in) and its account library
// hasn't finished its first full pull, which this device's library waits to join (every merge waits
// for it, mergeWaits), this device's library stays open, until a sign-in lets the pull and the merge
// run.
async function libraryToOpen(session: Session | null): Promise<{ target: Library; own: Library }> {
  const own = libraryForSession(session);
  const device = deviceLibrary(getRegistry().libraries);
  if (!session || session.tokens || !waitsToJoin(device, own)) return { target: own, own };
  return { target: (await hasPulled(own)) ? own : device, own };
}

// Whether the library's first full pull has drained; one not in the list (new) hasn't pulled.
async function hasPulled(library: Library): Promise<boolean> {
  return isListed(library.id) && withLibraryDb(library.id, isFirstSyncDone);
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

// Every loss of the tokens once the boot is done (a sign-out, the server rejecting a refresh inside a
// sync run, a changed server) opens the library for the session without them (openLibraryForSession),
// in a paused section of its own, started outside the code that dropped them (a sync run can't wait
// for a pause). The boot does the same itself for a drop before this is installed (bootLibrary).
// Returns the unsubscribe.
export function watchTokenDrops(switchLibrary: SwitchLibrary): () => void {
  let hadTokens = Boolean(getSession()?.tokens);
  return onSessionChange((session) => {
    const dropped = hadTokens && session !== null && !session.tokens;
    hadTokens = Boolean(session?.tokens);
    if (!dropped) return;
    withSyncPaused(() => openLibraryForSession(getSession(), switchLibrary)).catch((error) =>
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
// is its owner's account library: at the sign-in, at every boot, at the end of the open library's
// first full pull and at the end of the push a committed merge waits for (runPendingMerges), so a
// merge that waited or failed is tried again (mergeRun.ts, crash-safe and idempotent). One marked for a library still listed is resumeMerges', so a boot never
// runs a merge twice. A failure doesn't fail the sign-in or the boot: the device library stays
// parked until the next try.
export async function mergeDeviceLibrary(): Promise<void> {
  const source = deviceLibraryToJoin();
  if (!source || source.mergedInto?.library === openLibraryId()) return;
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
// first full pull drains or a merge's passes into it have pushed (usePendingMerges).
export function runPendingMerges(): Promise<void> {
  return withSyncPaused(mergesDue);
}
