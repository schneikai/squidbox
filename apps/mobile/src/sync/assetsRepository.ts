import type { AssetRecord } from '@squidbox/shared';
import { and, asc, count, eq, isNotNull, isNull, not, or, sql, type SQL } from 'drizzle-orm';

import { nextUpdatedAt } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { readByIds } from './readByIds';
import { makeRepository } from './repository';
import { saveRecords } from './saveRecords';
import type { AssetFileNames } from '../library/fs';

const repository = makeRepository<AssetRecord>('assets', schema.assets);

/** Create new assets (full synced records). */
export const createAssets = repository.createMany;
export const createAsset = repository.create;

/** Patch synced fields of assets, by id. */
export const updateAssets = repository.updateMany;
export const updateAsset = repository.update;
export const updateAllAssets = repository.updateAll;

/** Move to the Deleted album (tombstone: set deletedAt). The files stay, so a restore is complete. */
export const deleteAssets = repository.remove;

/**
 * "Delete permanently": removes this device's copies of the assets' files, then sets purgedAt,
 * which no later version undoes (sync-design §7). The files go first, as with a purge arriving
 * through sync, so a crash can't leave files that no asset names any more; a crash in between leaves
 * an asset in the Deleted album without its copies here (it was being deleted). Resolves to the
 * newly purged rows.
 */
export async function purgeAssets(db: SyncDb, ids: string[], removeFiles: RemoveFiles): Promise<schema.AssetRow[]> {
  const notPurged = (rows: schema.AssetRow[]) => rows.filter((row) => row.purgedAt === null);
  const rows = notPurged(await readByIds(db, schema.assets, ids));
  if (rows.length === 0) return [];
  await removeFiles(await unsharedFiles(db, rows));
  return db.transaction(async (tx) => {
    const previous = notPurged(await readByIds(tx, schema.assets, ids));
    const purgedRows = previous.map(purged);
    await saveRecords(tx, 'assets', schema.assets, purgedRows, { previous });
    return purgedRows;
  });
}

export type RemoveFiles = (files: AssetFileNames[]) => Promise<void>;

/**
 * The file names of these assets that no other asset that isn't purged names, in one statement:
 * what removing their copies may delete, as the server keeps a key in use (§7a). One scan of the
 * assets per call (~20 ms for 50k on a laptop), cheaper than two more indexes every insert pays for.
 */
export async function unsharedFiles(db: SyncDb, rows: schema.AssetRow[]): Promise<AssetFileNames[]> {
  const ids = rows.map((row) => row.id);
  const names = [...new Set(rows.flatMap((row) => [row.filename, row.thumbnailFilename]))];
  const sharing = await db
    .select({ filename: schema.assets.filename, thumbnailFilename: schema.assets.thumbnailFilename })
    .from(schema.assets)
    .where(
      and(
        isNull(schema.assets.purgedAt),
        not(inJson(schema.assets.id, ids)),
        or(inJson(schema.assets.filename, names), inJson(schema.assets.thumbnailFilename, names)),
      ),
    );
  const inUse = new Set(sharing.flatMap((row) => [row.filename, row.thumbnailFilename]));
  const unshared = (name: string) => (name && !inUse.has(name) ? name : undefined);
  return rows.map((row) => ({ filename: unshared(row.filename), thumbnailFilename: unshared(row.thumbnailFilename) }));
}

function purged(row: schema.AssetRow): schema.AssetRow {
  const ts = nextUpdatedAt(row.updatedAt);
  return { ...row, updatedAt: ts, deletedAt: row.deletedAt ?? ts, purgedAt: ts };
}

export const toggleFavorite = (db: SyncDb, id: string) => repository.toggle(db, id, 'isFavorite');

// The local-only sync-error marker (never synced) of the assets matching `where`, written only where
// it changes.
function writeSyncError(db: SyncDb, where: SQL, error: string | null) {
  return db
    .update(schema.assets)
    .set({ syncError: error })
    .where(and(where, sql`${schema.assets.syncError} is not ${error}`));
}

/** Sets the sync error of some assets, in one statement; null clears it. */
export async function setSyncError(db: SyncDb, ids: string[], error: string | null): Promise<void> {
  await writeSyncError(db, inJson(schema.assets.id, ids), error);
}

/** How many of these assets are photos and how many videos, in one statement (for a sheet title). */
export async function countByMediaType(db: SyncDb, ids: string[]): Promise<{ photo: number; video: number }> {
  const groups = await db
    .select({ mediaType: schema.assets.mediaType, count: count() })
    .from(schema.assets)
    .where(inJson(schema.assets.id, ids))
    .groupBy(schema.assets.mediaType);
  const counts = { photo: 0, video: 0 };
  for (const group of groups) counts[group.mediaType] = group.count;
  return counts;
}

// A purged asset is deleted too; it's checked as well, so its file is never uploaded (§7a).
const unsynced = and(
  eq(schema.assets.isSynced, false),
  isNull(schema.assets.deletedAt),
  isNull(schema.assets.purgedAt),
  isNull(schema.assets.syncError),
);
const failed = and(isNotNull(schema.assets.syncError), isNull(schema.assets.deletedAt));

/** The ids of the assets to upload, in id order: one backup run walks this snapshot. */
export async function readUnsyncedIds(db: SyncDb): Promise<string[]> {
  const rows = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(unsynced)
    .orderBy(asc(schema.assets.id));
  return rows.map((row) => row.id);
}

/** Whether this asset row still needs its upload, as `readUnsyncedIds` selects them. */
export function isUnsynced(asset: Pick<schema.AssetRow, 'isSynced' | 'deletedAt' | 'purgedAt' | 'syncError'>): boolean {
  return !asset.isSynced && asset.deletedAt === null && asset.purgedAt === null && asset.syncError === null;
}

/**
 * How many assets wait for their upload and how many failed (together: the photos not in the cloud,
 * deleted ones not), in one statement.
 */
export async function readBackupCounts(db: SyncDb): Promise<{ unsyncedCount: number; syncErrorCount: number }> {
  const [row] = await db
    .select({
      unsyncedCount: count(),
      syncErrorCount: sql<number>`(select count(*) from ${schema.assets} where ${failed})`,
    })
    .from(schema.assets)
    .where(unsynced);
  return { unsyncedCount: row?.unsyncedCount ?? 0, syncErrorCount: Number(row?.syncErrorCount ?? 0) };
}

export async function countSyncErrors(db: SyncDb): Promise<number> {
  const [row] = await db.select({ count: count() }).from(schema.assets).where(failed);
  return row?.count ?? 0;
}

/** The assets whose upload failed, by id, with their count (a paged read, like the query builders'). */
export async function readSyncErrors(db: SyncDb, { limit }: { limit: number }) {
  return db.transaction(async (tx) => {
    const total = await countSyncErrors(tx);
    const rows = await tx.select().from(schema.assets).where(failed).orderBy(asc(schema.assets.id)).limit(limit);
    return { rows, count: total };
  });
}

/** Clears the sync error of every live asset, in one statement, so each failed upload is tried again. */
export async function clearSyncErrors(db: SyncDb): Promise<void> {
  await writeSyncError(db, isNull(schema.assets.deletedAt), null);
}
