import { assetCollection } from '@squidbox/shared';
import { and, gt, isNotNull, not, or, sql, type SQL } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { SQL_BATCH } from './sqlBatch';
import { getMergeTarget, getOwner, isFirstSyncDone } from './status';
import type { AssetFileNames } from '../library/fs';

/** Removes this device's copies of these files (library/fs purgedFilesRemover, for the open library). */
export type RemoveFiles = (files: AssetFileNames[]) => Promise<void>;

// An asset whose purge waits for the server: its pending outbox row names the final field. The library
// merge states the same rule in JS (`purgeWaits` in library/mergeLibrary.ts).
const pendingPurge = sql`exists (select 1 from ${schema.outbox} where ${schema.outbox.collection} = ${assetCollection.name}
  and ${schema.outbox.recordId} = ${schema.assets.id}
  and json_extract(${schema.outbox.fields}, ${`$.${assetCollection.finalField}`}) is not null)`;

// A purged asset whose files this device hasn't removed for this purge yet (an undone purge's mark
// doesn't count for a later one).
const filesToRemove = sql`${schema.assets.filesRemovedFor} is not ${schema.assets.purgedAt}`;

/**
 * Removes this device's copies of the purged assets whose files it still has, once their purge is
 * confirmed (sync-design §7a), and marks each with the purge it removed them for (`filesRemovedFor`).
 * Only the names no other asset still uses go. An asset whose files can't be removed is left for the
 * next sweep and holds up no other; the sweep throws once it has gone through them all. It stops
 * between batches once `signal` aborts, or once nothing is confirmed any more (a full resync began).
 * An account library sweeps at the end of its sync runs; a device library at its open and after a
 * purge (library/current.ts sweepOpenLibrary).
 */
export async function sweepPurgedFiles(
  db: SyncDb,
  removeFiles: RemoveFiles,
  { signal }: { signal?: AbortSignal } = {},
): Promise<void> {
  const failures: unknown[] = [];
  let after = '';
  while (!signal?.aborted) {
    const confirmed = await confirmedPurges(db);
    if (!confirmed) break;
    const rows = await db
      .select({
        id: schema.assets.id,
        filename: schema.assets.filename,
        thumbnailFilename: schema.assets.thumbnailFilename,
      })
      .from(schema.assets)
      .where(and(confirmed, filesToRemove, gt(schema.assets.id, after)))
      .orderBy(schema.assets.id)
      .limit(SQL_BATCH);
    if (rows.length === 0) break;
    after = rows[rows.length - 1]!.id;
    const removed = await removeEach(removeFiles, rows, await unsharedFiles(db, rows, confirmed), failures);
    if (removed.length > 0)
      await db
        .update(schema.assets)
        .set({ filesRemovedFor: sql`${schema.assets.purgedAt}` })
        .where(inJson(schema.assets.id, removed));
  }
  if (failures.length > 0) {
    const first = failures[0] instanceof Error ? failures[0].message : String(failures[0]);
    throw new Error(`Could not remove the files of ${failures.length} purged assets: ${first}`);
  }
}

// Removes a batch's files in one call; when that fails, asset by asset, so one file that can't go
// holds up none of the others. Returns the ids whose files are gone.
async function removeEach(
  removeFiles: RemoveFiles,
  rows: { id: string }[],
  files: AssetFileNames[],
  failures: unknown[],
): Promise<string[]> {
  try {
    await removeFiles(files);
    return rows.map((row) => row.id);
  } catch {
    const removed: string[] = [];
    for (const [i, row] of rows.entries()) {
      try {
        await removeFiles([files[i]!]);
        removed.push(row.id);
      } catch (error) {
        failures.push(error);
      }
    }
    return removed;
  }
}

/**
 * The assets whose purge is confirmed, or null while none may be swept. A library that syncs has its
 * purges confirmed by the server, and only once it is fully pulled (a full resync clears the first-sync
 * flag): before that, a live asset not pulled yet could share a purged one's file name. A device
 * library's purge is final at once, as nothing can restore it, unless a merge pass has copied its
 * records into an account (the merge marker): then, as with an account, its purges wait.
 */
async function confirmedPurges(db: SyncDb): Promise<SQL | null> {
  const purged = isNotNull(schema.assets.purgedAt);
  const confirmedByServer = and(purged, not(pendingPurge))!;
  if ((await getOwner(db))?.kind === 'device') return (await getMergeTarget(db)) ? confirmedByServer : purged;
  return (await isFirstSyncDone(db)) ? confirmedByServer : null;
}

// The file names of these assets (all of them confirmed purges) that no asset whose purge isn't
// confirmed uses, in one statement, as the server keeps a key in use (§7a).
async function unsharedFiles(
  db: SyncDb,
  rows: { filename: string; thumbnailFilename: string }[],
  confirmed: SQL,
): Promise<AssetFileNames[]> {
  const names = [...new Set(rows.flatMap((row) => [row.filename, row.thumbnailFilename]))];
  const sharing = await db
    .select({ filename: schema.assets.filename, thumbnailFilename: schema.assets.thumbnailFilename })
    .from(schema.assets)
    .where(
      and(not(confirmed), or(inJson(schema.assets.filename, names), inJson(schema.assets.thumbnailFilename, names))),
    );
  const inUseNames = new Set(sharing.flatMap((row) => [row.filename, row.thumbnailFilename]));
  const unshared = (name: string) => (name && !inUseNames.has(name) ? name : undefined);
  return rows.map((row) => ({ filename: unshared(row.filename), thumbnailFilename: unshared(row.thumbnailFilename) }));
}
