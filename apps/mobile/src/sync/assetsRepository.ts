import { uniqueTags, type AssetRecord } from '@squidbox/shared';
import { and, asc, count, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';

import { nextUpdatedAt, nextVersion } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { readByIds } from './readByIds';
import { makeRepository } from './repository';
import { saveRecords } from './saveRecords';

const repository = makeRepository<AssetRecord>('assets', schema.assets);

// `remove` moves to the Deleted album (tombstone: set deletedAt). The files stay, so a restore is complete.
export const { create, createMany, update, updateMany, updateAll, remove } = repository;

/**
 * "Delete permanently": sets purgedAt, which no later version undoes once the server has it (sync-design
 * §7). The files stay until the server confirms the purge (sweepPurgedFiles): a restore on another device it
 * hadn't seen beats it, and the asset then comes back here with its files. Resolves to the newly
 * purged rows.
 */
export async function purgeAssets(db: SyncDb, ids: string[]): Promise<schema.AssetRow[]> {
  return db.transaction(async (tx) => {
    const previous = (await readByIds<schema.AssetRow>(tx, schema.assets, ids)).filter((row) => row.purgedAt === null);
    const purgedRows = previous.map(purged);
    await saveRecords(tx, 'assets', schema.assets, purgedRows, { previous });
    return purgedRows;
  });
}

function purged(row: schema.AssetRow): schema.AssetRow {
  const ts = nextUpdatedAt(row.updatedAt);
  return { ...row, updatedAt: ts, deletedAt: row.deletedAt ?? ts, purgedAt: ts };
}

// favoritedAt is the time of the favoriting, null once unfavorited.
export const toggleFavorite = (db: SyncDb, id: string) =>
  repository.toggle(db, id, 'isFavorite', (row) => ({ favoritedAt: row.isFavorite ? row.updatedAt : null }));

/**
 * Stores the asset's tags (POST /ai/tags, or the user's fixes), trimmed and each once; [] is "No
 * tags". `tags` can be a function of the stored ones (null while never tagged), run inside the
 * write's transaction, so an edit based on them never loses one stored in between; it returns null to
 * leave them. A list equal to the stored one writes nothing. Only on an asset still in the library: resolves to the stored list,
 * or null when it is gone or deleted (a tagging that ended after a delete writes nothing).
 */
export async function setTags(
  db: SyncDb,
  id: string,
  tags: string[] | ((stored: string[] | null) => string[] | null),
): Promise<string[] | null> {
  return db.transaction(async (tx) => {
    const previous = (await readByIds<schema.AssetRow>(tx, schema.assets, [id])).filter(
      (row) => row.deletedAt === null,
    );
    if (previous.length === 0) return null;
    const next = typeof tags === 'function' ? tags(previous[0]!.tags) : tags;
    if (next === null) return previous[0]!.tags;
    const stored = uniqueTags(next);
    if (JSON.stringify(stored) === JSON.stringify(previous[0]!.tags)) return stored;
    const rows = previous.map((row) => nextVersion(row, { tags: stored }));
    await saveRecords(tx, 'assets', schema.assets, rows, { previous });
    return stored;
  });
}

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
