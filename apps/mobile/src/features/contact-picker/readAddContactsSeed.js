import { and, eq, isNull } from 'drizzle-orm';

import albumQuery from '@/features/album-list/albumQuery';
import contactQuery from '@/features/contact-list/contactQuery';
import { schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';

const TABLES = { asset: schema.assets, album: schema.albums, post: schema.posts };
const TITLES = { asset: 'On this photo', album: 'On this album', post: 'On this post' };

const idsOf = (rows) => rows.map((row) => row.id);

/**
 * What the Add contacts sheet starts from, for a photo, album or post (`{ targetType, targetId }`) or
 * a list (`{ listId }`): its `title` ("to 1 photo", "to Sea to Sky"), the `linked` contacts' ids
 * with their section's `linkedTitle`, and the `related` sections: contacts on what it is part of or
 * holds, `{ title, ids }` (a photo's albums one by one; an album's photos; a post's photos and
 * albums). `null` when the target is gone.
 */
export default async function readAddContactsSeed(db, { targetType, targetId, listId }) {
  if (listId) {
    const [list] = await readByIds(db, schema.contactLists, [listId]);
    if (!list || list.deletedAt) return null;
    const linked = await contactQuery({ scope: { listId } }).ids(db);
    return { title: `to ${list.name}`, linkedTitle: 'In this list', linked, related: [] };
  }
  const [target] = await readByIds(db, TABLES[targetType], [targetId]);
  if (!target || target.deletedAt) return null;
  const linked = await contactQuery({ scope: { targetType, targetId } }).ids(db);
  const onTargets = async (type, ids) =>
    ids.length ? contactQuery({ scope: { targetType: type, targetId: ids } }).ids(db) : [];
  const related = [];

  if (targetType === 'asset') {
    const albums = await albumQuery({ scope: { assetIds: [targetId] } }).read(db);
    for (const album of albums)
      related.push({ title: `Also in ${album.name}`, ids: await onTargets('album', [album.id]) });
  } else {
    const edges = targetType === 'album' ? schema.albumAssets : schema.postAssets;
    const parent = targetType === 'album' ? edges.albumId : edges.postId;
    const assetIds = (
      await db
        .select({ id: edges.assetId })
        .from(edges)
        .where(and(eq(parent, targetId), isNull(edges.deletedAt)))
    ).map((row) => row.id);
    related.push({ title: 'On its photos', ids: await onTargets('asset', assetIds) });
    if (targetType === 'post') {
      const albums = await albumQuery({ scope: { assetIds } }).read(db);
      related.push({ title: 'On its albums', ids: await onTargets('album', idsOf(albums)) });
    }
  }

  const title = { asset: 'to 1 photo', album: `to ${target.name}`, post: 'to this post' }[targetType];
  return { title, linkedTitle: TITLES[targetType], linked, related: related.filter((section) => section.ids.length) };
}
