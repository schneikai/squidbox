import { openLibraryId } from './current';
import { libraryPaths } from './libraryPaths';
import { addsRecords, applyMerge, moveMergedFiles, planMerge, type MergePlan } from './mergeLibrary';
import { getRegistry, updateLibrary, type Library } from './registry';
import { removeLibrary } from './removeLibrary';

import { getDb, withAppDb } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
import { setMergeTarget } from '@/sync/status';

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
 * again and never joins another account. A throw before the commit clears the marker; a crash
 * leaves it, and the boot runs the merge again (resumeMerges): planMerge finds what is left to
 * add, so every stage is idempotent.
 */
export async function mergeLibrary(sourceId: string, targetId: string): Promise<void> {
  await setMarker(sourceId, targetId);
  const keepsSource = await withBothDbs(sourceId, targetId, async (source, target) => {
    let plan: MergePlan;
    try {
      plan = await planMerge(source, target, libraryPaths(sourceId));
      if (addsRecords(plan)) {
        await setMergeTarget(source, targetId); // its purges wait from here (sweepPurgedFiles)
        await applyMerge(target, plan);
      }
    } catch (error) {
      await setMarker(sourceId, undefined);
      throw error;
    }
    await moveMergedFiles(plan, libraryPaths(sourceId), libraryPaths(targetId));
    if (plan.keepsSource) await setMergeTarget(source, null); // done: what it copied has its files in the target
    return plan.keepsSource;
  });
  if (keepsSource) await setKept(sourceId, targetId);
  else await removeLibrary(sourceId);
}

/**
 * Boot: runs every merge whose marker is set again, finishing one a crash interrupted (a marker
 * whose target is gone is just cleared). A marked source that is the open library (a device
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
