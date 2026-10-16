import { openLibraryId } from './current';
import { libraryPaths } from './libraryPaths';
import { applyMerge, moveMergedFiles, planMerge, type MergePlan } from './mergeLibrary';
import { getRegistry, updateLibrary, type Library } from './registry';
import { removeLibrary } from './removeLibrary';

import { getDb, openAppDb } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';

export interface MergeOutcome {
  cloudOnly: number; // photos that stay in the source, which is kept for them
}

// A library's database for the merge: the open one as it is, a parked one on its own connection,
// closed again afterwards. Never opens the open library's name a second time.
async function withLibraryDb<T>(id: string, use: (db: SyncDb) => Promise<T>): Promise<T> {
  if (openLibraryId() === id) return use(getDb());
  const db = await openAppDb(libraryPaths(id).dbName);
  try {
    return await use(db);
  } finally {
    await db.close();
  }
}

function withBothDbs<T>(sourceId: string, targetId: string, use: (source: SyncDb, target: SyncDb) => Promise<T>) {
  return withLibraryDb(sourceId, (source) => withLibraryDb(targetId, (target) => use(source, target)));
}

function setMarker(sourceId: string, targetId: string | undefined): Promise<unknown> {
  return updateLibrary(sourceId, ({ mergedInto: _mergedInto, ...library }) =>
    targetId ? { ...library, mergedInto: targetId } : library,
  );
}

/**
 * Adds the source library to the target in three resumable stages (library-ownership plan §1.5
 * (f)), inside the caller's paused sync section: the marker, then every record in one transaction
 * of the target; then the files of the assets that are in the target by id; then the source is
 * removed, unless photos living in another account's storage keep it. A throw before the commit
 * clears the marker; a crash leaves it, and the boot resumes (resumeMerges) from the source's
 * state. Both databases are opened once.
 */
export async function mergeLibrary(sourceId: string, targetId: string): Promise<MergeOutcome> {
  await setMarker(sourceId, targetId);
  const cloudOnly = await withBothDbs(sourceId, targetId, async (source, target) => {
    let plan: MergePlan;
    try {
      plan = await planMerge(source, target, libraryPaths(sourceId));
      await applyMerge(target, plan);
    } catch (error) {
      await setMarker(sourceId, undefined);
      throw error;
    }
    // Everything the plan held is in the target now; the copied assets' files follow.
    await moveMergedFiles([...plan.assets, ...plan.sameIdAssets], libraryPaths(sourceId), libraryPaths(targetId));
    return plan.cloudOnly;
  });
  await finishMerge(sourceId, cloudOnly);
  return { cloudOnly };
}

// Stage 3: the source goes once nothing is left in it, else it stays, listed and unmarked. The
// "not open" check is removeLibrary's own, at the moment of the delete.
async function finishMerge(sourceId: string, cloudOnly: number): Promise<void> {
  if (cloudOnly === 0 && openLibraryId() !== sourceId) await removeLibrary(sourceId);
  else await setMarker(sourceId, undefined);
}

// A merge a crash interrupted, from the source's state: when the copy committed (nothing left to
// add), the files the target lacks move and the source finishes as above; a copy that never
// committed leaves everything to add, so the marker stays and the user is asked again at the
// next sign-in.
async function completeMerge(sourceId: string, targetId: string): Promise<void> {
  const plan = await withBothDbs(sourceId, targetId, async (source, target) => {
    const plan = await planMerge(source, target, libraryPaths(sourceId));
    if (plan.nothingLeftToAdd) {
      await moveMergedFiles(plan.sameIdAssets, libraryPaths(sourceId), libraryPaths(targetId));
    }
    return plan;
  });
  if (plan.nothingLeftToAdd) await finishMerge(sourceId, plan.cloudOnly);
}

/**
 * Boot: finishes every merge a crash interrupted (a marker whose target is gone is just cleared).
 * Runs inside withSyncPaused, serialized with every switch.
 */
export async function resumeMerges(): Promise<void> {
  const { libraries } = getRegistry();
  const marked = libraries.filter((library): library is Library & { mergedInto: string } =>
    Boolean(library.mergedInto),
  );
  for (const source of marked) {
    if (libraries.some(({ id }) => id === source.mergedInto)) await completeMerge(source.id, source.mergedInto);
    else await setMarker(source.id, undefined);
  }
}
