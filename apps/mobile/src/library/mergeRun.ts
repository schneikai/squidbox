import { openLibraryId } from './current';
import { libraryPaths } from './libraryPaths';
import { addsRecords, applyMerge, moveMergedFiles, planMerge, type MergePlan } from './mergeLibrary';
import { getRegistry, updateLibrary, type Library } from './registry';
import { removeLibrary } from './removeLibrary';

import { getDb, withAppDb } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
import { getMergeTarget, isFirstSyncDone, setMergeTarget } from '@/sync/status';

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

/**
 * Adds the source library to the target in resumable stages, inside the caller's paused sync
 * section: the marker, every record in one transaction of the target, the files of the assets
 * that are in the target by id, then the source is removed, unless photos living in another
 * account's storage keep it, recorded as kept for the target (`keptFor`), so it is never merged
 * again and never joins another account. The marker is in the list (what the boot resumes) and,
 * from the commit of a pass that copies records, in the source's database (its purges wait for the
 * account from then on, §7a); only a merge that completes clears them. A pass that throws before its
 * commit leaves both as they were before it, so a first one leaves none and one after an earlier
 * commit keeps them; a crash leaves them, and the boot runs the merge again (resumeMerges): planMerge
 * finds what is left to add, so every stage is idempotent. A source an earlier pass copied into a
 * library that is gone may be in the account already: its merge waits for the target's first full
 * pull (the boot tries again), which brings those records, so the device's edits and deletions of
 * them replay by id instead of being left behind.
 */
export async function mergeLibrary(sourceId: string, targetId: string): Promise<void> {
  const resumed = Boolean(getRegistry().libraries.find(({ id }) => id === sourceId)?.mergedInto);
  await setMarker(sourceId, targetId);
  const outcome = await withBothDbs(sourceId, targetId, async (source, target) => {
    const copiedInto = await getMergeTarget(source);
    const copied = copiedInto !== null;
    if (copied && copiedInto !== targetId && !(await isFirstSyncDone(target))) return 'waits';
    let plan: MergePlan;
    try {
      plan = await planMerge(source, target, libraryPaths(sourceId));
      if (addsRecords(plan)) {
        // Set before the target's commit (two databases can't share one): a pass that fails takes it back.
        if (!copied) await setMergeTarget(source, targetId);
        await applyMerge(target, plan);
      }
    } catch (error) {
      if (!copied) await setMergeTarget(source, null);
      if (!resumed) await setMarker(sourceId, undefined);
      throw error;
    }
    await moveMergedFiles(plan, libraryPaths(sourceId), libraryPaths(targetId));
    if (plan.keepsSource) await setMergeTarget(source, null); // done: what it copied has its files in the target
    return plan.keepsSource ? 'kept' : 'done';
  });
  if (outcome === 'kept') await setKept(sourceId, targetId);
  else if (outcome === 'done') await removeLibrary(sourceId);
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
