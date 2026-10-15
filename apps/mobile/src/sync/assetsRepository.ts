import type { AssetRecord } from '@squidbox/shared';
import { and, asc, count, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { makeRepository } from './repository';

const repository = makeRepository<AssetRecord>('assets', schema.assets);

/** Create new assets (full synced records). */
export const createAssets = repository.createMany;
export const createAsset = repository.create;

/** Patch synced fields of assets, by id. */
export const updateAssets = repository.updateMany;
export const updateAsset = repository.update;
export const updateAllAssets = repository.updateAll;

/** Soft-delete (tombstone): set deletedAt. Binary/thumbnail cleanup is the caller's job. */
export const deleteAssets = repository.remove;

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

const unsynced = and(
  eq(schema.assets.isSynced, false),
  isNull(schema.assets.deletedAt),
  isNull(schema.assets.syncError),
);
const failed = and(isNotNull(schema.assets.syncError), isNull(schema.assets.deletedAt));
const atRisk = and(eq(schema.assets.isSynced, false), isNull(schema.assets.deletedAt));

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
export function isUnsynced(asset: { isSynced: boolean; deletedAt: number | null; syncError: string | null }): boolean {
  return !asset.isSynced && asset.deletedAt === null && asset.syncError === null;
}

export interface BackupCounts {
  unsyncedCount: number; // waiting for their upload
  syncErrorCount: number; // whose upload failed
  atRiskCount: number; // not in the cloud at all: both of the above (deleted ones not)
}

/** How many assets wait for their upload, how many failed, and how many are not in the cloud, in one statement. */
export async function readBackupCounts(db: SyncDb): Promise<BackupCounts> {
  const [row] = await db
    .select({
      unsyncedCount: count(),
      syncErrorCount: sql<number>`(select count(*) from ${schema.assets} where ${failed})`,
      atRiskCount: sql<number>`(select count(*) from ${schema.assets} where ${atRisk})`,
    })
    .from(schema.assets)
    .where(unsynced);
  return {
    unsyncedCount: row?.unsyncedCount ?? 0,
    syncErrorCount: Number(row?.syncErrorCount ?? 0),
    atRiskCount: Number(row?.atRiskCount ?? 0),
  };
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
