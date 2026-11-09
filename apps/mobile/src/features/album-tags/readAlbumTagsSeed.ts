import type { AlbumTagsPhoto } from './albumTagsDraft';

import type { AppSettings } from '@/features/app-settings/appSettingsDefaults';
import assetQuery from '@/features/asset-list/assetQuery';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { readByIds } from '@/sync/readByIds';
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
    const [album] = await readByIds(tx, schema.albums, [albumId]);
    if (!album || album.deletedAt || album.smartAlbumType) return null;
    const ids = await assetQuery({ scope: { albumId }, sort: getAlbumSortOrder(album, albumSortOrders) }).ids(tx);
    const rows = await readByIds(tx, schema.assets, ids);
    return { photos: rows.map((row) => ({ id: row.id, tags: row.tags })) };
  });
}
