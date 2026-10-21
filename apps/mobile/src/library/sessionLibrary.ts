import { openLibraryEntry, openLibraryId } from './current';
import { listDatabaseNames } from './fs';
import { libraryPaths } from './libraryPaths';
import { mergeLibrary, resumeMerges } from './mergeRun';
import { deviceLibrary, getRegistry, type Library } from './registry';
import type { Session } from './session';
import { sessionMatches } from './sessionMatches';

import { getDb, withAppDb } from '@/sync/db/client';
import { isFirstSyncDone } from '@/sync/status';
import { withSyncPaused } from '@/sync/worker';
import { getSession, updateSession } from '@/utils/cloud-api/sessionStore';
import getNewItemId from '@/utils/getNewItemId';

// The session is the open pointer: no session means this device's library, a session its owner's
// (both created when missing, by the switch), with or without tokens, so a signed-out or expired
// session keeps its library open.
export function libraryForSession(session: Session | null): Library {
  const { libraries } = getRegistry();
  if (!session) return deviceLibrary(libraries) ?? { id: getNewItemId(), owner: { kind: 'device' } };
  const existing = libraries.find((library) => sessionMatches(library, session));
  if (existing) return existing;
  const { serverId, userId, email } = session;
  return { id: getNewItemId(), owner: { kind: 'account', serverId, userId, email: email ?? '' } };
}

// At boot and at a sign-out: opens the session's library (libraryToOpen), switching when another one
// is open.
export async function openLibraryForSession(
  session: Session | null,
  switchLibrary: (target: Library) => Promise<void>,
): Promise<void> {
  const target = await libraryToOpen(session);
  if (openLibraryId() !== target.id) await switchLibrary(target);
}

// The session's library (libraryForSession), unless it would hide this iPhone's photos: while the
// session can't pull (no tokens: signed out, or the server wants a new sign-in) and its account
// library hasn't finished its first full pull, which this device's library waits to join (every
// merge waits for it, mergeWaits), this device's library stays open, until a sign-in lets the pull
// and the merge run.
async function libraryToOpen(session: Session | null): Promise<Library> {
  const own = libraryForSession(session);
  const device = deviceLibrary(getRegistry().libraries);
  if (!session || session.tokens || !device || device.keptFor || device.mergedInto) return own;
  return (await hasPulled(own)) ? own : device;
}

// Whether the library's first full pull has drained; a library without a database hasn't pulled.
async function hasPulled(library: Library): Promise<boolean> {
  if (library.id === openLibraryId()) return isFirstSyncDone(getDb());
  const { dbName } = libraryPaths(library.id);
  if (!(await listDatabaseNames()).includes(dbName)) return false;
  return withAppDb(dbName, isFirstSyncDone);
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

// This device's library when it is to join the open library, by the list (which follows the device
// library's own database, mergeRun.ts): the open library is its owner's account library, and the
// device library isn't kept for a library or merging into another. One already merging into the open
// library counts (it waits for that library's first pull).
export function deviceLibraryToJoin(): Library | null {
  const source = deviceLibrary(getRegistry().libraries);
  const target = openLibraryEntry();
  if (!source || !target || source.id === target.id || !sessionMatches(target, getSession())) return null;
  return source.keptFor || (source.mergedInto && source.mergedInto !== target.id) ? null : source;
}

// Whatever this device's library holds (added before any sign-in) joins the open library when that
// is its owner's account library: at the sign-in, at every boot and at the end of the open library's
// first full pull (runPendingMerges), so a merge that waited or failed is tried again (mergeRun.ts,
// crash-safe and idempotent). One already marked is resumeMerges', so a boot never runs a merge
// twice. A failure doesn't fail the sign-in or the boot: the device library stays parked until the
// next try.
export async function mergeDeviceLibrary(): Promise<void> {
  const source = deviceLibraryToJoin();
  if (!source || source.mergedInto) return;
  try {
    await mergeLibrary(source.id, openLibraryEntry()!.id);
  } catch (error) {
    console.warn('Could not add this device’s library to the account', error);
  }
}

// Every merge due, serialized with every switch and sync run: those a crash or a failure interrupted
// (resumeMerges), then this device's library. At the boot, and when the open library's first full
// pull drains (useMergeAfterFirstSync), as every merge waits for it.
export function runPendingMerges(): Promise<void> {
  return withSyncPaused(async () => {
    await resumeMerges();
    await mergeDeviceLibrary();
  });
}
