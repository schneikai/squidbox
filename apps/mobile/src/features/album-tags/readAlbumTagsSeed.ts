import type { AlbumTagsPhoto } from './albumTagsDraft';

import type { AppSettings } from '@/providers/app-settings/appSettingsDefaults';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import assetQuery from '@/sync/queries/assetQuery';
import { readByIds } from '@/sync/readByIds';
import readLiveAlbum from '@/sync/readLiveAlbum';
import getAlbumSortOrder from '@/utils/albums/getAlbumSortOrder';

export type AlbumTagsSeed = { photos: AlbumTagsPhoto[] };

/**
 * What an album's Tags sheet starts from: the album's live, untrashed photos (videos too) in the
 * order its screen shows them (getAlbumSortOrder), each with its tags. `null` when the album is
 * gone, deleted or smart (a smart album has no photos of its own). One transaction.
 */
export default function readAlbumTagsSeed(
  db: SyncDb,
  albumId: string,
  albumSortOrders: AppSettings['albumSortOrders'],
): Promise<AlbumTagsSeed | null> {
  return db.transaction(async (tx) => {
    const album = await readLiveAlbum(tx, albumId);
    if (!album || album.smartAlbumType) return null;
    // The photos Save writes to (readPhotoIdsOf: the untrashed assets of the album's live edges), in
    // the album screen's order, which only the grid's query knows.
    const ids = await assetQuery({ scope: { albumId }, sort: getAlbumSortOrder(album, albumSortOrders) }).ids(tx);
    const rows = await readByIds(tx, schema.assets, ids);
    return { photos: rows.map((row) => ({ id: row.id, tags: row.tags })) };
  });
}
