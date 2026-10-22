import { makeAssetRecord } from './factory';
import type { Prng } from './prng';
import * as schema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';
import { upsertRows } from '../../src/sync/upsertRows';

// The seeded merge fuzz runs (mergeRun.test.ts, mergeRunFailures.test.ts): their account and the
// check that a merge lost nothing of the device library.

export const FUZZ_MEDIA = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'];

/**
 * The account's photos of camera-roll items m0..m3 in its library (pulled), each with or without a
 * file in the cloud (and then maybe one on this phone, `addLocalFile`), a favorite, a note, a sync
 * error.
 */
export async function seedAccountPhotos(
  db: SyncDb,
  rand: Prng,
  addLocalFile: (filename: string) => void,
): Promise<schema.AssetRow[]> {
  const rows: schema.AssetRow[] = [];
  for (let i = 0; i < 4; i++) {
    const synced = rand.chance(0.5);
    const row = {
      ...makeAssetRecord({
        ...{ mediaLibraryAssetId: FUZZ_MEDIA[i]!, filename: `acc${i}.jpg`, thumbnailFilename: `acc${i}-t.jpg` },
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

/**
 * What a completed merge into the account's library `db` lost of the device library's live photos
 * (`liveDevice`, the album holding `inAlbum`): a photo with no record (by id or camera-roll item), a
 * live record without its file on this phone where the cloud has none (`hasFile`), a favorite, a
 * note, an album membership; and merge keys left in sync_meta. A record purged for good is gone with
 * what it held.
 */
export async function mergeLosses(
  db: SyncDb,
  liveDevice: schema.AssetRow[],
  inAlbum: string[],
  hasFile: (filename: string) => boolean,
  at: string,
): Promise<string[]> {
  const problems: string[] = [];
  const target = await db.select().from(schema.assets);
  const edges = (await db.select().from(schema.albumAssets)).filter((edge) => edge.deletedAt === null);
  for (const photo of liveDevice) {
    const byId = target.find((row) => row.id === photo.id);
    const into = byId ? [byId] : target.filter((row) => row.mediaLibraryAssetId === photo.mediaLibraryAssetId);
    if (into.length === 0) problems.push(`${at}: ${photo.filename} is missing`);
    for (const row of into.filter((row) => row.deletedAt === null && row.purgedAt === null))
      if ((byId || !row.isFileSynced) && !hasFile(row.filename)) problems.push(`${at}: ${row.filename} has no file`);
    if (into.some((row) => row.purgedAt !== null)) continue;
    if (photo.isFavorite && !into.some((row) => row.isFavorite)) problems.push(`${at}: ${photo.filename}'s favorite`);
    if (photo.notes && !into.some((row) => row.notes?.includes(photo.notes!)))
      problems.push(`${at}: ${photo.filename}'s note`);
    if (inAlbum.includes(photo.id) && !edges.some((edge) => into.some((row) => row.id === edge.assetId)))
      problems.push(`${at}: the album lost ${photo.filename}`);
  }
  const left = (await db.select().from(schema.syncMeta)).filter((row) => row.key.startsWith('merge'));
  if (left.length) problems.push(`${at}: ${left.map((row) => row.key)} left`);
  return problems;
}
