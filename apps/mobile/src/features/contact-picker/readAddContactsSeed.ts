import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { albumHoldsAny } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';
import contactQuery from '@/sync/queries/contactQuery';
import { readByIds } from '@/sync/readByIds';
import readLiveAlbum from '@/sync/readLiveAlbum';
import readPhotoIdsOf from '@/sync/readPhotoIdsOf';

/** What Add contacts adds to: a photo, an album's photos, or a list. */
export type AddContactsTarget = { assetId: string } | { albumId: string } | { listId: string };

/** A section of contacts Add contacts offers: a title and the contacts' ids, in order. */
export type ContactSection = { title: string; ids: string[] };

export type AddContactsSeed = {
  // Under the sheet's title: how many photos, for an album's several.
  subtitle?: string;
  linkedTitle: string;
  linked: string[];
  related: ContactSection[];
  // An album's photos: the linked contacts on only some of them (the rest are on all).
  partial?: string[];
};

type AlbumName = Pick<schema.AlbumRow, 'id' | 'name'>;

/**
 * What the Add contacts sheet starts from: its `subtitle` ("12 photos"), the `linked`
 * contacts' ids with their section's `linkedTitle`, and the `related` sections, `{ title, ids }`:
 * the contacts on the photos of each album a photo is in. For an album's photos the linked ones are
 * those on any of them, and `partial` those not on every one.
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
      const related = await onAlbumsPhotos(tx, await albumsHolding(tx, target.assetId));
      return { linkedTitle: 'On this photo', linked, related };
    }
    const album = await readLiveAlbum(tx, target.albumId);
    if (!album || album.smartAlbumType) return null;
    const photoIds = await readPhotoIdsOf(tx, target);
    const counts = await photoCounts(tx, photoIds);
    const linked = await contactQuery({ scope: { photosOf: target } }).ids(tx);
    return {
      subtitle: photoIds.length > 1 ? `${photoIds.length} photos` : undefined,
      linkedTitle: 'On its photos',
      linked,
      related: [],
      partial: linked.filter((id) => (counts.get(id) ?? 0) < photoIds.length),
    };
  });
}

// The live albums holding the asset (a smart album has no edges), by name: id and name.
async function albumsHolding(tx: SyncDb, assetId: string): Promise<AlbumName[]> {
  const al = schema.albums;
  return tx
    .select({ id: al.id, name: al.name })
    .from(al)
    .where(and(isNull(al.deletedAt), albumHoldsAny(al.id, [assetId])))
    .orderBy(asc(sql`${al.name} collate nocase`), asc(al.id));
}

// "Also in <album>": the live contacts on each album's untrashed photos, by name, for the albums
// with any: one read for them all.
async function onAlbumsPhotos(tx: SyncDb, albums: AlbumName[]): Promise<ContactSection[]> {
  if (albums.length === 0) return [];
  const albumIds = albums.map((album) => album.id);
  const { albumAssets: aa, assets: a, contactLinks: l, contacts: c } = schema;
  const rows = await tx
    .selectDistinct({ albumId: aa.albumId, contactId: c.id })
    .from(aa)
    .innerJoin(a, and(eq(a.id, aa.assetId), isNull(a.deletedAt)))
    .innerJoin(l, and(eq(l.targetType, 'asset'), eq(l.targetId, aa.assetId), isNull(l.deletedAt)))
    .innerJoin(c, and(eq(c.id, l.contactId), isNull(c.deletedAt)))
    .where(and(isNull(aa.deletedAt), inJson(aa.albumId, albumIds)))
    .orderBy(asc(sql`${c.name} collate nocase`), asc(c.id));
  const byAlbum = new Map<string, string[]>();
  for (const { albumId, contactId } of rows) byAlbum.set(albumId, [...(byAlbum.get(albumId) ?? []), contactId]);
  return albums.flatMap((album) => {
    const ids = byAlbum.get(album.id);
    return ids ? [{ title: `Also in ${album.name}`, ids }] : [];
  });
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
