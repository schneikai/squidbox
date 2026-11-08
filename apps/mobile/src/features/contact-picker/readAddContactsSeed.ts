import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { ContactsOf } from '@/features/contact-links/contactsOf';
import contactQuery from '@/features/contact-list/contactQuery';
import { albumHoldsAny } from '@/sync/assetSql';
import { schema } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import { readPhotoIdsOf } from '@/sync/photoContacts';
import { readByIds } from '@/sync/readByIds';
import pluralizeText from '@/utils/pluralizeText';

/** What Add contacts adds to: a photo, an album's or post's photos (ContactsOf), or a list. */
export type AddContactsTarget = ContactsOf | { listId: string };

/** A section of contacts Add contacts offers: a title and the contacts' ids, in order. */
export type ContactSection = { title: string; ids: string[] };

export type AddContactsSeed = {
  // Under the sheet's title: how many photos, for an album's or post's several.
  subtitle?: string;
  linkedTitle: string;
  linked: string[];
  related: ContactSection[];
  // An album's or post's photos: the linked contacts on only some of them (the rest are on all).
  partial?: string[];
};

type AlbumName = Pick<schema.AlbumRow, 'id' | 'name'>;

/**
 * What the Add contacts sheet starts from: its `subtitle` ("12 photos"), the `linked`
 * contacts' ids with their section's `linkedTitle`, and the `related` sections, `{ title, ids }`:
 * the contacts on the photos of each album a photo is in, or a post's photos are in. For an album's
 * or post's photos the linked ones are those on any of them, and `partial` those not on every one.
 * `null` when it is gone. One transaction.
 */
export default function readAddContactsSeed(db: SyncDb, target: AddContactsTarget): Promise<AddContactsSeed | null> {
  return db.transaction(async (tx) => {
    if ('listId' in target) {
      const { listId } = target;
      const [list] = await readByIds(tx, schema.contactLists, [listId]);
      if (!list || list.deletedAt) return null;
      const linked = await contactQuery({ scope: { listId } }).ids(tx);
      return { linkedTitle: 'In this list', linked, related: [] };
    }
    if ('assetId' in target) {
      const [asset] = await readByIds(tx, schema.assets, [target.assetId]);
      if (!asset || asset.deletedAt) return null;
      const linked = await contactQuery({ scope: { photoIds: [target.assetId] } }).ids(tx);
      const related = await onAlbumsPhotos(tx, await albumsHolding(tx, [target.assetId]));
      return { linkedTitle: 'On this photo', linked, related };
    }
    if ('albumId' in target) {
      const [album] = await readByIds(tx, schema.albums, [target.albumId]);
      if (!album || album.deletedAt || album.smartAlbumType) return null;
    } else {
      const [post] = await readByIds(tx, schema.posts, [target.postId]);
      if (!post || post.deletedAt) return null;
    }
    const photoIds = await readPhotoIdsOf(tx, target);
    const counts = await photoCounts(tx, photoIds);
    const linked = await contactQuery({ scope: { photosOf: target } }).ids(tx);
    // A post's photos' albums; an album is its own.
    const related = 'postId' in target ? await onAlbumsPhotos(tx, await albumsHolding(tx, photoIds)) : [];
    return {
      subtitle: photoIds.length > 1 ? pluralizeText('1 photo', '%{count} photos', photoIds.length) : undefined,
      linkedTitle: 'On its photos',
      linked,
      related,
      partial: linked.filter((id) => (counts.get(id) ?? 0) < photoIds.length),
    };
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

// "Also in <album>": the contacts on each album's photos, by name, for the albums with any.
async function onAlbumsPhotos(tx: SyncDb, albums: AlbumName[]): Promise<ContactSection[]> {
  const sections: ContactSection[] = [];
  for (const album of albums) {
    const ids = await contactQuery({ scope: { photosOf: { albumId: album.id } } }).ids(tx);
    if (ids.length) sections.push({ title: `Also in ${album.name}`, ids });
  }
  return sections;
}

// How many of these photos each contact is on.
async function photoCounts(tx: SyncDb, photoIds: string[]): Promise<Map<string, number>> {
  if (photoIds.length === 0) return new Map();
  const l = schema.contactLinks;
  const rows = await tx
    .select({ contactId: l.contactId, count: sql<number>`count(distinct ${l.targetId})` })
    .from(l)
    .where(and(eq(l.targetType, 'asset'), isNull(l.deletedAt), inJson(l.targetId, photoIds)))
    .groupBy(l.contactId);
  return new Map(rows.map((row) => [row.contactId, row.count]));
}
