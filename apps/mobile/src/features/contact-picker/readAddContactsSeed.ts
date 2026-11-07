import type { ContactLinkRecord } from '@squidbox/shared';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import assetQuery from '@/features/asset-list/assetQuery';
import contactQuery from '@/features/contact-list/contactQuery';
import { albumHoldsAny, liveAlbumAssetIds } from '@/sync/assetSql';
import type { CollectionTable } from '@/sync/clientCollections';
import { schema } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { readByIds } from '@/sync/readByIds';

type TargetType = ContactLinkRecord['targetType'];

const TABLES = { asset: schema.assets, album: schema.albums, post: schema.posts } satisfies Record<
  TargetType,
  CollectionTable
>;
const TITLES: Record<TargetType, string> = { asset: 'On this photo', album: 'On this album', post: 'On this post' };

/** What Add contacts adds to: a photo, album or post, a list, or every photo of an album. */
export type AddContactsTarget =
  { targetType: TargetType; targetId: string } | { listId: string } | { photosOfAlbumId: string };

/** A section of contacts Add contacts offers: a title and the contacts' ids, in order. */
export type ContactSection = { title: string; ids: string[] };

export type AddContactsSeed = {
  title: string;
  linkedTitle: string;
  linked: string[];
  related: ContactSection[];
  // Every photo of an album: the linked contacts on only some of them (the rest are on all).
  partial?: string[];
};

type AlbumName = Pick<schema.AlbumRow, 'id' | 'name'>;

/**
 * What the Add contacts sheet starts from, for a photo, album or post (`{ targetType, targetId }`) or
 * a list (`{ listId }`): its `title` ("to 1 photo", "to Sea to Sky"), the `linked` contacts' ids
 * with their section's `linkedTitle`, and the `related` sections: contacts on what it is part of or
 * holds, `{ title, ids }` (a photo's albums one by one; an album's photos; a post's photos and
 * albums). For every photo of an album (`{ photosOfAlbumId }`) the linked ones are those on any of
 * its photos or on the album itself, and `partial` those not on every one of them.
 * `null` when the target is gone. One transaction.
 */
export default function readAddContactsSeed(db: SyncDb, target: AddContactsTarget): Promise<AddContactsSeed | null> {
  return db.transaction(async (tx) => {
    if ('listId' in target) {
      const { listId } = target;
      const [list] = await readByIds(tx, schema.contactLists, [listId]);
      if (!list || list.deletedAt) return null;
      const linked = await contactQuery({ scope: { listId } }).ids(tx);
      return { title: `to ${list.name}`, linkedTitle: 'In this list', linked, related: [] };
    }
    if ('photosOfAlbumId' in target) {
      const albumId = target.photosOfAlbumId;
      const [album] = await readByIds(tx, schema.albums, [albumId]);
      if (!album || album.deletedAt || album.smartAlbumType) return null;
      const total = (await assetQuery({ scope: { albumId } }).ids(tx)).length;
      const counts = await photoCounts(tx, albumId);
      // On its photos, and on the album itself (from before only photos were tagged).
      const onPhotos = await contactQuery({ scope: { photosOf: 'album', id: albumId } }).ids(tx);
      const onAlbum = await contactQuery({ scope: { targetType: 'album', targetId: albumId } }).ids(tx);
      const linked = [...new Set([...onPhotos, ...onAlbum])];
      return {
        title: '',
        linkedTitle: 'On its photos',
        linked,
        related: [],
        partial: linked.filter((id) => (counts.get(id) ?? 0) < total),
      };
    }
    const { targetType, targetId } = target;
    const [record] = await readByIds(tx, TABLES[targetType], [targetId]);
    if (!record || record.deletedAt) return null;
    const linked = await contactQuery({ scope: { targetType, targetId } }).ids(tx);
    const onTargets = async (type: TargetType, ids: string[]): Promise<string[]> =>
      ids.length ? contactQuery({ scope: { targetType: type, targetId: ids } }).ids(tx) : [];
    const related: ContactSection[] = [];

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

    const title = { asset: 'to 1 photo', album: `to ${'name' in record ? record.name : ''}`, post: 'to this post' }[
      targetType
    ];
    return { title, linkedTitle: TITLES[targetType], linked, related: related.filter((section) => section.ids.length) };
  });
}

// The live albums holding any of these assets (a smart album has no edges), by name: id and name.
async function albumsHolding(tx: SyncDb, assetIds: string[]): Promise<AlbumName[]> {
  if (assetIds.length === 0) return [];
  const al = schema.albums;
  return tx
    .select({ id: al.id, name: al.name })
    .from(al)
    .where(and(isNull(al.deletedAt), albumHoldsAny(al.id, assetIds)))
    .orderBy(asc(sql`${al.name} collate nocase`), asc(al.id));
}

// The live contacts on each of these albums, by name: one read for them all.
async function contactsOnAlbums(tx: SyncDb, albums: AlbumName[]): Promise<Map<string, string[]>> {
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
  const byAlbum = new Map<string, string[]>();
  for (const { albumId, contactId } of rows) {
    const ids = byAlbum.get(albumId);
    if (ids) ids.push(contactId);
    else byAlbum.set(albumId, [contactId]);
  }
  return byAlbum;
}

// How many of the album's live photos each contact is on.
async function photoCounts(tx: SyncDb, albumId: string): Promise<Map<string, number>> {
  const l = schema.contactLinks;
  const rows = await tx
    .select({ contactId: l.contactId, count: sql<number>`count(distinct ${l.targetId})` })
    .from(l)
    .innerJoin(schema.assets, and(eq(schema.assets.id, l.targetId), isNull(schema.assets.deletedAt)))
    .where(and(eq(l.targetType, 'asset'), isNull(l.deletedAt), sql`${l.targetId} in ${liveAlbumAssetIds(albumId)}`))
    .groupBy(l.contactId);
  return new Map(rows.map((row) => [row.contactId, row.count]));
}
