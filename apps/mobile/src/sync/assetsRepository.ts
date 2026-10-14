import type { AssetRecord } from '@squidbox/shared';
import { and, asc, count, eq, gt, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';

import { inJson } from './assetSql';
import { chunk, SQL_BATCH } from './chunk';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
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

/** Sets the sync error of some assets; null clears it. */
export async function setSyncError(db: SyncDb, ids: string[], error: string | null): Promise<void> {
  for (const batch of chunk(ids, SQL_BATCH)) await writeSyncError(db, inArray(schema.assets.id, batch), error);
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

/**
 * The next assets to upload, by id after `afterId` (the key-walk of one backup run: each asset is
 * tried once whatever the run writes meanwhile).
 */
export async function readUnsynced(db: SyncDb, { afterId, limit }: { afterId: string | null; limit: number }) {
  return db
    .select()
    .from(schema.assets)
    .where(afterId === null ? unsynced : and(unsynced, gt(schema.assets.id, afterId)))
    .orderBy(asc(schema.assets.id))
    .limit(limit);
}

export async function countUnsynced(db: SyncDb): Promise<number> {
  const [row] = await db.select({ count: count() }).from(schema.assets).where(unsynced);
  return row?.count ?? 0;
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
