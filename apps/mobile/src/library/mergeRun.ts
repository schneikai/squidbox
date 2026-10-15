import { getLibrary, isLibraryOpen } from './current';
import { libraryPaths } from './libraryPaths';
import { applyMerge, moveMergedFiles, planMerge, type MergePlan } from './mergeLibrary';
import { getRegistry, updateLibrary, type Library } from './registry';
import { removeLibrary } from './removeLibrary';

import { getDb, openAppDb } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';

export interface MergeOutcome {
  removed: boolean; // the source library is gone: everything of it is in the target
  cloudOnly: number; // photos that stay in the source, which is kept for them
}

// A library's database for the merge: the open one as it is, a parked one on its own connection,
// closed again afterwards. Never opens the open library's name a second time.
async function withLibraryDb<T>(id: string, use: (db: SyncDb) => Promise<T>): Promise<T> {
  if (isLibraryOpen() && getLibrary().id === id) return use(getDb());
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

/** The dry run of adding `sourceId` to `targetId`. */
export function planMergeOf(sourceId: string, targetId: string): Promise<MergePlan> {
  return withBothDbs(sourceId, targetId, (source, target) => planMerge(source, target, libraryPaths(sourceId)));
}

/**
 * Adds the source library to the target in three resumable stages (library-ownership plan §1.5
 * (f)): the marker, then every record in one transaction of the target; then the files; then the
 * source is removed once nothing is left in it. A throw before the commit clears the marker; a
 * crash leaves it, and the boot resumes (resumeMerges) from the source's state.
 */
export async function mergeLibrary(sourceId: string, targetId: string): Promise<MergeOutcome> {
  await updateLibrary(sourceId, (library) => ({ ...library, mergedInto: targetId }));
  try {
    await withBothDbs(sourceId, targetId, async (source, target) => {
      await applyMerge(target, await planMerge(source, target, libraryPaths(sourceId)));
    });
  } catch (error) {
    await updateLibrary(sourceId, ({ mergedInto: _mergedInto, ...library }) => library);
    throw error;
  }
  return completeMerge(sourceId, targetId);
}

// Stages 2 and 3, driven by the target's state: when the copy committed (nothing left to add), move
// the files the target lacks, then remove the source, unless photos that live in another account's
// storage keep it. A copy that never committed leaves everything to add: the marker stays and the
// user is asked again at the next sign-in.
async function completeMerge(sourceId: string, targetId: string): Promise<MergeOutcome> {
  const plan = await withBothDbs(sourceId, targetId, async (source, target) => {
    const plan = await planMerge(source, target, libraryPaths(sourceId));
    if (plan.nothingLeftToAdd) await moveMergedFiles(plan.sameIdAssets, libraryPaths(sourceId), libraryPaths(targetId));
    return plan;
  });
  const { cloudOnly } = plan.counts;
  if (!plan.nothingLeftToAdd) return { removed: false, cloudOnly };
  if (cloudOnly === 0 && !(isLibraryOpen() && getLibrary().id === sourceId)) {
    await removeLibrary(sourceId);
    return { removed: true, cloudOnly };
  }
  await updateLibrary(sourceId, ({ mergedInto: _mergedInto, ...library }) => library);
  return { removed: false, cloudOnly };
}

/** Boot: finishes every merge a crash interrupted (a marker whose target is gone is just cleared). */
export async function resumeMerges(): Promise<void> {
  const { libraries } = getRegistry();
  const marked = libraries.filter((library): library is Library & { mergedInto: string } =>
    Boolean(library.mergedInto),
  );
  for (const source of marked) {
    if (libraries.some(({ id }) => id === source.mergedInto)) await completeMerge(source.id, source.mergedInto);
    else await updateLibrary(source.id, ({ mergedInto: _mergedInto, ...library }) => library);
  }
}
