import { makeAssetRecord } from './factory';
import type { prng } from './prng';
import * as schema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';
import { upsertRows } from '../../src/sync/upsertRows';

/**
 * The seeded merge fuzz runs' account: its photos of camera-roll items m0..m3 in its library
 * (pulled), each with or without a file in the cloud (and then maybe one on this phone,
 * `addLocalFile`), a favorite, a note, a sync error.
 */
export async function seedAccountPhotos(
  db: SyncDb,
  rand: ReturnType<typeof prng>,
  addLocalFile: (filename: string) => void,
): Promise<schema.AssetRow[]> {
  const rows: schema.AssetRow[] = [];
  for (let i = 0; i < 4; i++) {
    const synced = rand.chance(0.5);
    const row = {
      ...makeAssetRecord({
        ...{ mediaLibraryAssetId: `m${i}`, filename: `acc${i}.jpg`, thumbnailFilename: `acc${i}-t.jpg` },
        ...{ isFileSynced: synced, isThumbnailSynced: synced, isSynced: synced, isFavorite: rand.chance(0.3) },
        ...{ notes: rand.chance(0.3) ? `acc note ${i}` : null, updatedAt: 1000 + i },
      }),
      syncError: rand.chance(0.3) ? 'failed' : null,
    } as schema.AssetRow;
    await upsertRows(db, 'assets', schema.assets, [row]);
    if (!synced && rand.chance(0.5)) addLocalFile(row.filename);
    rows.push(row);
  }
  return rows;
}
