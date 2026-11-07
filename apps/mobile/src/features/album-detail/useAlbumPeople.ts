import { and, eq, isNull, sql } from 'drizzle-orm';

import useContactRows from '@/features/contact-list/useContactRows';
import * as schema from '@/sync/db/schema';
import { useLiveQuery } from '@/sync/useLiveQuery';

const l = schema.contactLinks;

/**
 * The contacts in an album, live: the ones on its untrashed photos and any put on the album itself
 * (from before only photos were tagged), by name, each with `photoCount`, how many of the album's
 * photos it is on. Undefined while reading.
 */
export default function useAlbumPeople(albumId: string) {
  const onAlbum = useContactRows({ scope: { targetType: 'album', targetId: albumId } });
  const onPhotos = useContactRows({ scope: { photosOf: 'album', id: albumId } });
  const counts = useLiveQuery(
    async (db) => {
      const rows = await db
        .select({ contactId: l.contactId, count: sql<number>`count(distinct ${l.targetId})` })
        .from(l)
        .innerJoin(schema.assets, and(eq(schema.assets.id, l.targetId), isNull(schema.assets.deletedAt)))
        .where(
          and(
            eq(l.targetType, 'asset'),
            isNull(l.deletedAt),
            sql`${l.targetId} in (select asset_id from album_assets where album_id = ${albumId} and deleted_at is null)`,
          ),
        )
        .groupBy(l.contactId);
      return new Map(rows.map((row) => [row.contactId, row.count]));
    },
    [schema.contactLinks, schema.assets, schema.albumAssets],
    [albumId],
  );

  if (!onAlbum || !onPhotos || !counts) return undefined;
  const onPhotoIds = new Set(onPhotos.map((contact) => contact.id));
  return [...onPhotos, ...onAlbum.filter((contact) => !onPhotoIds.has(contact.id))]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id))
    .map((contact) => ({ ...contact, photoCount: counts.get(contact.id) ?? 0 }));
}
