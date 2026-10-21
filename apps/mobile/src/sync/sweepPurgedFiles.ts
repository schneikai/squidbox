import { and, isNotNull, isNull, not, or, sql, type SQL } from 'drizzle-orm';

import { SQL_BATCH } from './chunk';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { getMergeTarget, getOwner, isFirstSyncDone } from './status';
import type { AssetFileNames } from '../library/fs';

/** Removes this device's copies of these files (library/fs removeAssetFiles, for the open library). */
export type RemoveFiles = (files: AssetFileNames[]) => Promise<void>;

// An asset whose purge waits for the server: its pending outbox row carries the deletion pair.
const pendingPurge = sql`exists (select 1 from ${schema.outbox} where ${schema.outbox.collection} = 'assets'
  and ${schema.outbox.recordId} = ${schema.assets.id} and json_extract(${schema.outbox.fields}, '$.purgedAt') is not null)`;

/**
 * Removes this device's copies of the purged assets whose files it still has, once their purge is
 * confirmed (sync-design §7a), and marks each `filesRemovedAt`. Only the names no other asset still
 * uses go. Runs at the end of every sync run, when a library opens and after a purge.
 */
export async function sweepPurgedFiles(db: SyncDb, removeFiles: RemoveFiles): Promise<void> {
  const confirmed = await confirmedPurges(db);
  if (!confirmed) return;
  for (;;) {
    const rows = await db
      .select({
        id: schema.assets.id,
        filename: schema.assets.filename,
        thumbnailFilename: schema.assets.thumbnailFilename,
      })
      .from(schema.assets)
      .where(and(confirmed, isNull(schema.assets.filesRemovedAt)))
      .limit(SQL_BATCH);
    if (rows.length === 0) return;
    const ids = rows.map((row) => row.id);
    await removeFiles(await unsharedFiles(db, rows, ids, not(confirmed)));
    await db.update(schema.assets).set({ filesRemovedAt: Date.now() }).where(inJson(schema.assets.id, ids));
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

// The file names of these assets that no other asset still uses, in one statement, as the server
// keeps a key in use (§7a).
async function unsharedFiles(
  db: SyncDb,
  rows: { filename: string; thumbnailFilename: string }[],
  ids: string[],
  inUse: SQL,
): Promise<AssetFileNames[]> {
  const names = [...new Set(rows.flatMap((row) => [row.filename, row.thumbnailFilename]))];
  const sharing = await db
    .select({ filename: schema.assets.filename, thumbnailFilename: schema.assets.thumbnailFilename })
    .from(schema.assets)
    .where(
      and(
        inUse,
        not(inJson(schema.assets.id, ids)),
        or(inJson(schema.assets.filename, names), inJson(schema.assets.thumbnailFilename, names)),
      ),
    );
  const inUseNames = new Set(sharing.flatMap((row) => [row.filename, row.thumbnailFilename]));
  const unshared = (name: string) => (name && !inUseNames.has(name) ? name : undefined);
  return rows.map((row) => ({ filename: unshared(row.filename), thumbnailFilename: unshared(row.thumbnailFilename) }));
}
