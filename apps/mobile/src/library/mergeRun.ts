import { openLibraryId } from './current';
import { libraryPaths } from './libraryPaths';
import { addsRecords, applyMerge, mergeWaits, moveMergedFiles, planMerge } from './mergeLibrary';
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

// A kept source is never merged again: what a merge keeps in it goes (the marker, which makes its
// purges wait, and its marks, which nothing reads any more).
async function forgetMerge(source: SyncDb, name: string): Promise<void> {
  await setMergeTarget(source, null);
  await setMergeMarks(source, name, null);
}

// A pass's end: it waits, completed (the source removed or kept), or found the source joined elsewhere.
type Outcome = 'waits' | 'done' | 'kept' | { keptFor: string } | { mergedInto: string };

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
 * The source's database is the authority on what it joined. A list rebuilt from the databases gets
 * its markers back from there (rebuildRegistry), so mergeDeviceLibrary leaves a marked source alone
 * and the boot resumes its merge. The checks here cover a list that is there but disagrees: a source
 * the list doesn't mark as kept, and one the list doesn't mark (or marks for another library) while
 * its database names a library still listed that a pass committed into: the list is pointed back
 * there, and the boot finishes that merge.
 */
export async function mergeLibrary(sourceId: string, targetId: string): Promise<void> {
  const resumed = Boolean(getRegistry().libraries.find(({ id }) => id === sourceId)?.mergedInto);
  const name = libraryPaths(sourceId).dbName;
  const outcome = await withBothDbs(sourceId, targetId, async (source, target): Promise<Outcome> => {
    const keptFor = await getKeptFor(source);
    if (keptFor) {
      await forgetMerge(source, name); // a kept merge a crash interrupted after recording it
      return { keptFor };
    }
    const copiedInto = await getMergeTarget(source);
    const listed = getRegistry().libraries.some(({ id }) => id === copiedInto);
    if (copiedInto && copiedInto !== targetId && listed) return { mergedInto: copiedInto };
    if (await mergeWaits(source, target)) return 'waits';
    const plan = await planMerge(source, target, libraryPaths(sourceId));
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
