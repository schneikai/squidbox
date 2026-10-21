import { openLibraryId } from './current';
import { libraryPaths } from './libraryPaths';
import { addsRecords, applyMerge, moveMergedFiles, planMerge } from './mergeLibrary';
import { getRegistry, updateLibrary, type Library } from './registry';
import { removeLibrary } from './removeLibrary';

import { getDb, withAppDb } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
import { getKeptFor, getMergeTarget, setKeptFor, setMergeMarks, setMergeTarget } from '@/sync/status';

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

// What the source library's own database says it joined elsewhere, so it joins no other library:
// kept for one (never merged again), or committed into one that is still there (finished there).
async function joinedElsewhere(
  source: SyncDb,
  targetId: string,
): Promise<{ keptFor: string } | { mergedInto: string } | null> {
  const keptFor = await getKeptFor(source);
  if (keptFor) {
    await setMergeTarget(source, null); // a kept merge a crash interrupted at its last step
    return { keptFor };
  }
  const copiedInto = await getMergeTarget(source);
  const exists = getRegistry().libraries.some(({ id }) => id === copiedInto);
  return copiedInto && copiedInto !== targetId && exists ? { mergedInto: copiedInto } : null;
}

/**
 * Adds the source library to the target in resumable stages, inside the caller's paused sync
 * section: the marker, every record in one transaction of the target, the files of the assets
 * that are in the target by id, then the source is removed, unless photos living in another
 * account's storage keep it, recorded as kept for the target (`keptFor`), so it is never merged
 * again and never joins another account.
 *
 * Nothing happens before the target's first full pull has drained (planMerge waits): the boot and
 * the end of that pull try again (useMergeAfterFirstSync). The markers are in the list (what the boot
 * resumes) and in the source's database (the authority the list is rebuilt from; from the commit of
 * a pass that copies records, its purges wait for the account, §7a): a source joined to a library
 * that is still there joins no other, the list taking the source's word. Only a merge that completes
 * clears them. A pass that throws before its commit leaves both as they were before it; a crash
 * leaves them, and the boot runs the merge again (resumeMerges): planMerge replays what the device
 * changed since along the decisions recorded (getMergeMarks), so every stage is idempotent.
 */
export async function mergeLibrary(sourceId: string, targetId: string): Promise<void> {
  const resumed = Boolean(getRegistry().libraries.find(({ id }) => id === sourceId)?.mergedInto);
  const outcome = await withBothDbs(sourceId, targetId, async (source, target) => {
    const joined = await joinedElsewhere(source, targetId);
    if (joined) return joined;
    const copiedInto = await getMergeTarget(source);
    const plan = await planMerge(source, target, libraryPaths(sourceId));
    if (plan.waits) return 'waits';
    await setMarker(sourceId, targetId);
    try {
      if (addsRecords(plan)) {
        // Set before the target's commit (two databases can't share one): a pass that fails takes it back.
        await setMergeTarget(source, targetId);
        await applyMerge(target, plan);
      }
    } catch (error) {
      await setMergeTarget(source, copiedInto);
      if (!resumed) await setMarker(sourceId, undefined);
      throw error;
    }
    await setMergeMarks(source, plan.marks.source, plan.marks.decided);
    await moveMergedFiles(plan, libraryPaths(sourceId), libraryPaths(targetId));
    if (plan.keepsSource) {
      await setKeptFor(source, targetId);
      await setMergeTarget(source, null); // done: what it copied has its files in the target
    }
    await setMergeMarks(target, plan.marks.source, null);
    return plan.keepsSource ? 'kept' : 'done';
  });
  if (outcome === 'waits') return;
  if (outcome === 'done') await removeLibrary(sourceId);
  else if (outcome === 'kept') await setKept(sourceId, targetId);
  else if ('keptFor' in outcome) await setKept(sourceId, outcome.keptFor);
  else await setMarker(sourceId, outcome.mergedInto);
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
