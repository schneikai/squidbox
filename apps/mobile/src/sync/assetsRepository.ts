import type { AssetRecord } from '@squidbox/shared';
import { and, inArray, sql } from 'drizzle-orm';

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

/** Local-only sync-error marker (never synced), for some assets. Writes only where it changes. */
export async function setSyncError(db: SyncDb, ids: string[], error: string | null): Promise<void> {
  for (const batch of chunk(ids, SQL_BATCH)) {
    await db
      .update(schema.assets)
      .set({ syncError: error })
      .where(and(inArray(schema.assets.id, batch), sql`${schema.assets.syncError} is not ${error}`));
  }
}
