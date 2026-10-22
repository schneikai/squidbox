import { openLibraryId } from './current';
import { libraryPaths } from './libraryPaths';
import {
  applyMerge,
  commitsTarget,
  finishMerge,
  mergeWaits,
  moveMergedFiles,
  planMerge,
  writesTarget,
} from './mergeLibrary';
import { hasJoined, joinedElsewhere, type MergeMarker } from './mergeMarker';
import { getRegistry, isListed, updateLibrary } from './registry';
import { removeLibrary } from './removeLibrary';
import { withLibraryDb } from './withLibraryDb';

import { setSyncError } from '@/sync/assetsRepository';
import type { SyncDb } from '@/sync/db/types';
import { outboxVersion } from '@/sync/outbox';
import {
  getKeptFor,
  getMergeCommit,
  getMergeTarget,
  isPushed,
  setKeptFor,
  setMergeCommit,
  setMergeMarks,
  setMergeTarget,
} from '@/sync/status';
import { requestSync } from '@/sync/worker';

function withBothDbs<T>(sourceId: string, targetId: string, use: (source: SyncDb, target: SyncDb) => Promise<T>) {
  return withLibraryDb(sourceId, (source) => withLibraryDb(targetId, (target) => use(source, target)));
}

// The list's marker; the list is written only when it changes.
function setMarker(sourceId: string, marker: MergeMarker | undefined): Promise<unknown> {
  return updateLibrary(sourceId, (library) => {
    if (JSON.stringify(library.mergedInto) === JSON.stringify(marker)) return library;
    const { mergedInto: _mergedInto, ...rest } = library;
    return marker ? { ...rest, mergedInto: marker } : rest;
  });
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
type Outcome = 'waits' | 'done' | 'kept' | { keptFor: string } | { mergedInto: MergeMarker };

/**
 * Adds the source library to the target in resumable stages, inside the caller's paused sync
 * section: the marker, every record in one transaction of the target, the files of the assets
 * that end up in the target, then, once the target has pushed what its passes wrote (sync-design
 * §8), the source learns their decisions and is removed, unless photos living in another account's
 * storage keep it, recorded as kept for the target (`keptFor`), so it is never merged again and
 * never joins another account. Once a pass committed into the target (commitsTarget), the source's
 * marker says `committed`: it has joined the target and never opens again for it (sessionLibrary.ts).
 * Until the push the source waits; the boot, a sign-in and the end of the push run this again
 * (runPendingMerges), which plans nothing while the push waits and the source is as the last pass
 * saw it.
 *
 * Nothing happens before the target's first full pull has drained (mergeWaits): the boot and the end
 * of that pull try again (runPendingMerges). The marker (mergeMarker.ts) is in the list (what the
 * boot resumes) and in the source's database (from the commit of any pass that writes or moves
 * files; its purges wait for the account then, §7a). Only a merge that completes clears them. A pass
 * that throws before its commit leaves both as they were before it, joined if it had joined before;
 * a crash leaves them, and the boot runs the merge again (resumeMerges): planMerge replays what the
 * device changed since along the decisions recorded (getMergeMarks), so every stage is idempotent.
 *
 * The source's database is the authority on what it joined (joinedElsewhere). The list follows it:
 * a list rebuilt from the databases gets the markers back (rebuildRegistry), and the installed
 * build's list-only markers went into the databases once (backfillMergeMarkers), so the screens and
 * mergeDeviceLibrary read the list alone. Where a list still disagrees, the check here repairs it:
 * a source kept for a library is recorded so, and one merging into another listed library is
 * pointed back there (the boot finishes that merge).
 */
export async function mergeLibrary(sourceId: string, targetId: string): Promise<void> {
  const { libraries } = getRegistry();
  const before = libraries.find(({ id }) => id === sourceId)?.mergedInto;
  const target = libraries.find(({ id }) => id === targetId);
  if (target?.owner.kind !== 'account') throw new Error(`No account library ${targetId}`);
  const marker: MergeMarker = { library: targetId, serverId: target.owner.serverId, userId: target.owner.userId };
  const [sourcePaths, targetPaths] = [libraryPaths(sourceId), libraryPaths(targetId)];
  const name = sourcePaths.dbName;
  const outcome = await withBothDbs(sourceId, targetId, async (sourceDb, targetDb): Promise<Outcome> => {
    const markers = { keptFor: await getKeptFor(sourceDb), mergedInto: await getMergeTarget(sourceDb) };
    const joined = joinedElsewhere(markers, target);
    if (joined === 'waits') return 'waits'; // for a library of the account it joined
    if (joined && 'keptFor' in joined) await forgetMerge(sourceDb, name); // a kept merge a crash interrupted
    if (joined) return joined;
    if (await mergeWaits(sourceDb, targetDb)) return 'waits';
    const commit = await getMergeCommit(targetDb, name);
    const sourceVersion = await outboxVersion(sourceDb);
    if (commit?.source === sourceVersion && !(await isPushed(targetDb, commit))) return 'waits'; // nothing new
    const plan = await planMerge(sourceDb, targetDb, sourcePaths, targetPaths);
    const joinedTarget = { ...marker, committed: true as const };
    // Joined already: a pass committed here (its commit waits, or the finish ran and the source stayed).
    const joinedBefore = Boolean(commit) || hasJoined(markers.mergedInto, targetId);
    const passMarker = joinedBefore ? joinedTarget : marker;
    await setMarker(sourceId, passMarker);
    let committed = commit;
    try {
      if (commitsTarget(plan)) {
        // Set before the target's commit (two databases can't share one): a pass that fails takes it back.
        await setMergeTarget(sourceDb, passMarker);
        committed = await applyMerge(targetDb, plan);
        if (writesTarget(plan)) requestSync(); // its rows push once this paused section ends
      }
    } catch (error) {
      if (!joinedBefore) {
        await setMergeTarget(sourceDb, markers.mergedInto);
        await setMarker(sourceId, before);
      }
      throw error;
    }
    // Committed: the source has joined the target, in its database and the list (each written only
    // when it changes), before any file moves into the target's folders.
    if (committed) {
      await setMergeTarget(sourceDb, joinedTarget);
      await setMarker(sourceId, joinedTarget);
    }
    await moveMergedFiles(plan, sourcePaths, targetPaths);
    await setSyncError(targetDb, plan.retried, null); // only once their files arrived
    if (committed) {
      await setMergeCommit(targetDb, name, { ...committed, source: sourceVersion });
      if (!(await isPushed(targetDb, committed))) return 'waits';
    }
    await finishMerge(sourceDb, targetDb, name); // complete: before keptFor, which ends every later pass
    if (!plan.keepsSource) return 'done';
    await setKeptFor(sourceDb, targetId);
    await forgetMerge(sourceDb, name);
    return 'kept';
  });
  if (outcome === 'waits') return;
  if (outcome === 'done') await removeLibrary(sourceId);
  else if (outcome === 'kept') await setKept(sourceId, targetId);
  else if ('keptFor' in outcome) await setKept(sourceId, outcome.keptFor);
  else await setMarker(sourceId, outcome.mergedInto);
}

/**
 * At the boot, a sign-in, the end of the open library's first full pull and the end of the push a
 * merge waits for (runPendingMerges): runs every merge whose marker names a library still listed
 * again, finishing one a crash or a failure interrupted, or one whose target has pushed. A marker
 * whose library is gone stays (it holds the account the source belongs to): a library of that
 * account takes the source over (mergeDeviceLibrary). A marked source that is the open library (a
 * device library opened again before it joined) waits for a boot that opens another; a merge that
 * fails waits for the next try without stopping the others. Runs inside withSyncPaused, serialized
 * with every switch.
 */
export async function resumeMerges(): Promise<void> {
  const { libraries } = getRegistry();
  for (const source of libraries) {
    const marker = source.mergedInto;
    if (!marker || source.id === openLibraryId() || !isListed(marker.library)) continue;
    try {
      await mergeLibrary(source.id, marker.library);
    } catch (error) {
      console.warn(`Could not resume the merge of library ${source.id}`, error);
    }
  }
}
