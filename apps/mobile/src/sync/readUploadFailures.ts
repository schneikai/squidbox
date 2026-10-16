import { readSyncErrors } from './assetsRepository';
import type { SyncDb } from './db/types';
import { describeAsset } from './describeAsset';

/** The assets whose upload failed, as the sync error viewer's `{ id, title, error }` rows, with their count. */
export async function readUploadFailures(db: SyncDb, page: { limit: number }) {
  const { rows, count } = await readSyncErrors(db, page);
  return { rows: rows.map((asset) => ({ id: asset.id, title: describeAsset(asset), error: asset.syncError })), count };
}
