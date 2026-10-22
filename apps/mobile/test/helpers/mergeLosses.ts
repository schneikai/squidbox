import * as schema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';

/**
 * What a completed merge into the account's library `db` lost of the device library's live photos
 * (`liveDevice`, the album holding `inAlbum`), for the seeded merge fuzz runs: a photo with no record
 * (by id or camera-roll item), a record by id without its file on this phone (`hasFile`), an item
 * none of whose live records has a file here or in the cloud, a favorite, a note, an album membership;
 * and merge keys left in sync_meta. A record purged for good is gone with what it held.
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
    const live = into.filter((row) => row.deletedAt === null && row.purgedAt === null);
    if (byId && live.length > 0) {
      if (!hasFile(byId.filename)) problems.push(`${at}: ${byId.filename} has no file`);
    } else if (live.length > 0 && !live.some((row) => row.isFileSynced || hasFile(row.filename)))
      problems.push(`${at}: no record of ${photo.filename}'s item has a file`);
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
