import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import assetQuery from '@/features/asset-list/assetQuery';
import contactQuery from '@/features/contact-list/contactQuery';
import { schema } from '@/sync/db/client';
import { inJson } from '@/sync/inJson';
import { readByIds } from '@/sync/readByIds';

const TABLES = { asset: schema.assets, album: schema.albums, post: schema.posts };
const TITLES = { asset: 'On this photo', album: 'On this album', post: 'On this post' };

/**
 * What the Add contacts sheet starts from, for a photo, album or post (`{ targetType, targetId }`) or
 * a list (`{ listId }`): its `title` ("to 1 photo", "to Sea to Sky"), the `linked` contacts' ids
 * with their section's `linkedTitle`, and the `related` sections: contacts on what it is part of or
 * holds, `{ title, ids }` (a photo's albums one by one; an album's photos; a post's photos and
 * albums). `null` when the target is gone. One transaction.
 */
export default function readAddContactsSeed(db, { targetType, targetId, listId }) {
  return db.transaction(async (tx) => {
    if (listId) {
      const [list] = await readByIds(tx, schema.contactLists, [listId]);
      if (!list || list.deletedAt) return null;
      const linked = await contactQuery({ scope: { listId } }).ids(tx);
      return { title: `to ${list.name}`, linkedTitle: 'In this list', linked, related: [] };
    }
    const [target] = await readByIds(tx, TABLES[targetType], [targetId]);
    if (!target || target.deletedAt) return null;
    const linked = await contactQuery({ scope: { targetType, targetId } }).ids(tx);
    const onTargets = async (type, ids) =>
      ids.length ? contactQuery({ scope: { targetType: type, targetId: ids } }).ids(tx) : [];
    const related = [];

    if (targetType === 'asset') {
      const albums = await albumsHolding(tx, [targetId]);
      const onAlbums = await contactsOnAlbums(tx, albums);
      for (const album of albums) related.push({ title: `Also in ${album.name}`, ids: onAlbums.get(album.id) ?? [] });
    } else {
      // The photos it shows: the canonical live edges of live assets (assetQuery's scope).
      const assetIds = await assetQuery({
        scope: targetType === 'album' ? { albumId: targetId } : { postId: targetId },
      }).ids(tx);
      related.push({ title: 'On its photos', ids: await onTargets('asset', assetIds) });
      if (targetType === 'post') {
        const albums = await albumsHolding(tx, assetIds);
        related.push({
          title: 'On its albums',
          ids: await onTargets(
            'album',
            albums.map((album) => album.id),
          ),
        });
      }
    }

    const title = { asset: 'to 1 photo', album: `to ${target.name}`, post: 'to this post' }[targetType];
    return { title, linkedTitle: TITLES[targetType], linked, related: related.filter((section) => section.ids.length) };
  });
}

// The live albums holding any of these assets (a smart album has no edges), by name: id and name.
function albumsHolding(tx, assetIds) {
  if (assetIds.length === 0) return [];
  const al = schema.albums;
  return tx
    .select({ id: al.id, name: al.name })
    .from(al)
    .where(
      and(
        isNull(al.deletedAt),
        sql`exists (select 1 from album_assets where album_id = ${al.id} and deleted_at is null and ${inJson(sql.raw('asset_id'), assetIds)})`,
      ),
    )
    .orderBy(asc(sql`${al.name} collate nocase`), asc(al.id));
}

// The live contacts on each of these albums, by name: one read for them all.
async function contactsOnAlbums(tx, albums) {
  if (albums.length === 0) return new Map();
  const l = schema.contactLinks;
  const c = schema.contacts;
  const rows = await tx
    .select({ albumId: l.targetId, contactId: c.id })
    .from(l)
    .innerJoin(c, and(eq(c.id, l.contactId), isNull(c.deletedAt)))
    .where(
      and(
        eq(l.targetType, 'album'),
        isNull(l.deletedAt),
        inJson(
          l.targetId,
          albums.map((album) => album.id),
        ),
      ),
    )
    .orderBy(asc(sql`${c.name} collate nocase`), asc(c.id));
  const byAlbum = new Map();
  for (const { albumId, contactId } of rows) byAlbum.set(albumId, [...(byAlbum.get(albumId) ?? []), contactId]);
  return byAlbum;
}
