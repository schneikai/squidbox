import { openLibraryId } from './current';
import { libraryPaths } from './libraryPaths';
import { addsRecords, applyMerge, mergeWaits, moveMergedFiles, planMerge } from './mergeLibrary';
import { getRegistry, updateLibrary, type Library } from './registry';
import { removeLibrary } from './removeLibrary';
import { sameAccount } from './sameAccount';

import { getDb, withAppDb } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
import {
  getKeptFor,
  getMergeAccount,
  getMergeTarget,
  setKeptFor,
  setMergeAccount,
  setMergeMarks,
  setMergeTarget,
  type MergeAccount,
} from '@/sync/status';

// A library's database for the merge: the open one as it is (never opened a second time), a
// parked one on its own connection, closed again afterwards.
function withLibraryDb<T>(id: string, use: (db: SyncDb) => Promise<T>): Promise<T> {
  if (openLibraryId() === id) return use(getDb());
  return withAppDb(libraryPaths(id).dbName, use);
}

function withBothDbs<T>(sourceId: string, targetId: string, use: (source: SyncDb, target: SyncDb) => Promise<T>) {
  return withLibraryDb(sourceId, (source) => withLibraryDb(targetId, (target) => use(source, target)));
}

function setMarker(sourceId: string, targetId: string | undefined): Promise<unknown> {
  return updateLibrary(sourceId, ({ mergedInto: _mergedInto, ...library }) =>
    targetId ? { ...library, mergedInto: targetId } : library,
  );
}

// The merge is complete and the source stays: the marker gives way to the record of what it joined.
function setKept(sourceId: string, targetId: string): Promise<unknown> {
  return updateLibrary(sourceId, ({ mergedInto: _mergedInto, ...library }) => ({ ...library, keptFor: targetId }));
}

// A kept source is never merged again: what a merge keeps in it goes (the marker, which makes its
// purges wait, its account and its marks, which nothing reads any more).
async function forgetMerge(source: SyncDb, name: string): Promise<void> {
  await setMergeTarget(source, null);
  await setMergeAccount(source, null);
  await setMergeMarks(source, name, null);
}

type Joined = { keptFor: string } | { mergedInto: string } | { account: MergeAccount };

/**
 * What the source library's own database says it joined, when that keeps it from joining the
 * target: kept for a library (never merged again), committed into another library still listed
 * (finished there), or into another account's library (its records are that account's: nothing of
 * it goes to another account, and it waits, files and all, for a library of that account). Reads
 * only.
 */
async function joinedElsewhere(source: SyncDb, target: Library): Promise<Joined | null> {
  const keptFor = await getKeptFor(source);
  if (keptFor) return { keptFor };
  const copiedInto = await getMergeTarget(source);
  const listed = getRegistry().libraries.some(({ id }) => id === copiedInto);
  if (copiedInto && copiedInto !== target.id && listed) return { mergedInto: copiedInto };
  const account = await getMergeAccount(source);
  const owner = target.owner;
  return account && !(owner.kind === 'account' && sameAccount(account, owner)) ? { account } : null;
}

// A pass's end: it waits, completed (the source removed or kept), or found the source joined elsewhere.
type Outcome = 'waits' | 'done' | 'kept' | Joined;

/**
 * Adds the source library to the target in resumable stages, inside the caller's paused sync
 * section: the marker, every record in one transaction of the target, the files of the assets
 * that are in the target by id, then the source is removed, unless photos living in another
 * account's storage keep it, recorded as kept for the target (`keptFor`), so it is never merged
 * again and never joins another account.
 *
 * Nothing happens before the target's first full pull has drained (mergeWaits): the boot and the end
 * of that pull try again (runPendingMerges). The markers are in the list (what the boot resumes) and
 * in the source's database (from the commit of a pass that copies records; its purges wait for the
 * account then, §7a). Only a merge that completes clears them. A pass that throws before its commit
 * leaves both as they were before it; a crash leaves them, and the boot runs the merge again
 * (resumeMerges): planMerge replays what the device changed since along the decisions recorded
 * (getMergeMarks), so every stage is idempotent.
 *
 * The source's database is the authority on what it joined (joinedElsewhere). The list follows it:
 * a list rebuilt from the databases gets the markers back (rebuildRegistry), and the installed
 * build's list-only markers went into the databases once (backfillMergeMarkers), so the screens and
 * mergeDeviceLibrary can read the list alone. Where a list still disagrees, the check here repairs
 * it: a source kept for a library is recorded so, one committed into another listed library is
 * pointed back there (the boot finishes that merge), and one committed into another account's
 * library is left as it is.
 */
export async function mergeLibrary(sourceId: string, targetId: string): Promise<void> {
  const resumed = Boolean(getRegistry().libraries.find(({ id }) => id === sourceId)?.mergedInto);
  const name = libraryPaths(sourceId).dbName;
  const outcome = await withBothDbs(sourceId, targetId, async (source, target): Promise<Outcome> => {
    const targetLibrary = getRegistry().libraries.find(({ id }) => id === targetId);
    if (!targetLibrary || targetLibrary.owner.kind !== 'account') throw new Error(`No account library ${targetId}`);
    const joined = await joinedElsewhere(source, targetLibrary);
    if (joined && 'keptFor' in joined) await forgetMerge(source, name); // a kept merge a crash interrupted
    if (joined) return joined;
    if (await mergeWaits(source, target)) return 'waits';
    const copiedInto = await getMergeTarget(source);
    const account = await getMergeAccount(source);
    const plan = await planMerge(source, target, libraryPaths(sourceId));
    await setMarker(sourceId, targetId);
    try {
      if (addsRecords(plan)) {
        // Set before the target's commit (two databases can't share one): a pass that fails takes it back.
        await setMergeTarget(source, targetId);
        if (!account) await setMergeAccount(source, targetLibrary.owner);
        await applyMerge(target, plan);
      }
    } catch (error) {
      await setMergeTarget(source, copiedInto);
      await setMergeAccount(source, account);
      if (!resumed) await setMarker(sourceId, undefined);
      throw error;
    }
    await setMergeMarks(source, name, plan.marks.decided);
    await moveMergedFiles(plan, libraryPaths(sourceId), libraryPaths(targetId));
    await setMergeMarks(target, name, null); // complete: before keptFor, which ends every later pass
    if (!plan.keepsSource) return 'done';
    await setKeptFor(source, targetId);
    await forgetMerge(source, name);
    return 'kept';
  });
  if (outcome === 'waits') return;
  if (outcome === 'done') await removeLibrary(sourceId);
  else if (outcome === 'kept') await setKept(sourceId, targetId);
  else if ('keptFor' in outcome) await setKept(sourceId, outcome.keptFor);
  else if ('mergedInto' in outcome) await setMarker(sourceId, outcome.mergedInto);
}

/**
 * Boot: runs every merge whose marker is set again, finishing one a crash or a failure interrupted
 * (the list's marker of one whose target is gone is just cleared; the source's own stays, as records
 * it copied may be in the account). A marked source that is the open library (a device
 * library opened again after the session was lost) waits for a boot that opens another; a merge
 * that fails waits for the next boot without stopping the others. Runs inside withSyncPaused,
 * serialized with every switch.
 */
export async function resumeMerges(): Promise<void> {
  const { libraries } = getRegistry();
  const marked = libraries.filter((library): library is Library & { mergedInto: string } =>
    Boolean(library.mergedInto),
  );
  for (const source of marked) {
    if (source.id === openLibraryId()) continue;
    try {
      if (libraries.some(({ id }) => id === source.mergedInto)) await mergeLibrary(source.id, source.mergedInto);
      else await setMarker(source.id, undefined);
    } catch (error) {
      console.warn(`Could not resume the merge of library ${source.id}`, error);
    }
  }
}
