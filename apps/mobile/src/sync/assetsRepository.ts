import type { AssetRecord } from '@squidbox/shared';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import * as schema from './db/schema';
import type { AssetRow } from './db/schema';
import type { SyncDb } from './db/types';
import { makeRepository } from './repository';

const repository = makeRepository<AssetRecord>('assets', schema.assets);

function toRecord(row: AssetRow): AssetRecord {
  const { syncError: _syncError, ...record } = row;
  return record as unknown as AssetRecord;
}

/** All live (non-tombstoned) assets, id-keyed — matches the shape screens consume. */
export async function loadAssetsMap(db: SyncDb): Promise<Record<string, AssetRecord>> {
  const rows = await db.select().from(schema.assets).where(isNull(schema.assets.deletedAt));
  const map: Record<string, AssetRecord> = {};
  for (const row of rows) map[row.id] = toRecord(row);
  return map;
}

/** Create new assets (full synced records). */
export const createAssets = repository.createMany;
export const createAsset = repository.create;

/** Patch synced fields of assets, by id. */
export const updateAssets = repository.updateMany;
export const updateAsset = repository.update;

/** Soft-delete (tombstone): set deletedAt. Binary/thumbnail cleanup is the caller's job. */
export const deleteAssets = repository.remove;

export async function toggleFavorite(db: SyncDb, id: string): Promise<void> {
  const row = await db.select().from(schema.assets).where(eq(schema.assets.id, id)).get();
  if (row) await updateAsset(db, id, { isFavorite: !row.isFavorite });
}

/** Local-only sync-error marker (never synced), for some assets. Writes only where it changes. */
export async function setSyncError(db: SyncDb, ids: string[], error: string | null): Promise<void> {
  await db
    .update(schema.assets)
    .set({ syncError: error })
    .where(and(inArray(schema.assets.id, ids), sql`${schema.assets.syncError} is not ${error}`));
}
