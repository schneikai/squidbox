import { and, asc, desc, eq, inArray, isNull, max, sql } from 'drizzle-orm';

import { albumAssetIdsOf } from './assetSql';
import { nextUpdatedAt } from './clock';
import * as schema from './db/schema';
import type { ContactRow } from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { contactLinks, contactListMembers } from './membershipRepository';
import { readByIds } from './readByIds';
import { makeRepository } from './repository';
import { saveRecords } from './saveRecords';

const repository = makeRepository('contacts', schema.contacts);

// `remove` is the tombstone (deletedAt) alone; a contact the user deletes is `deleteContact`.
// The photo (`avatarFilename`, a file field) is uploaded by the sync before the record is pushed.
export const { create, update, remove, toggle } = repository;

/**
 * Deletes a contact: its tombstone, and it leaves every list, photo, album and post, those edges
 * tombstoned at the contact's own `deletedAt`, in one write, so `restore` can put it back where it
 * was. That stamp is newer than every edge of the contact, so no edge removed before (in the same
 * millisecond, say) carries it.
 */
export async function deleteContact(db: SyncDb, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [contact] = await readByIds(tx, schema.contacts, [id]);
    if (!contact || contact.deletedAt !== null) return;
    const newestEdge = await Promise.all(
      [schema.contactListMembers, schema.contactLinks].map(async (table) => {
        const [row] = await tx
          .select({ newest: max(table.updatedAt) })
          .from(table)
          .where(eq(table.contactId, id));
        return row?.newest ?? 0;
      }),
    );
    const deletedAt = nextUpdatedAt(Math.max(contact.updatedAt, ...newestEdge));
    await saveRecords(tx, 'contacts', schema.contacts, [{ ...contact, updatedAt: deletedAt, deletedAt }], {
      previous: [contact],
    });
    await contactListMembers.tombstoneWhere(tx, { contactId: id }, deletedAt);
    await contactLinks.tombstoneWhere(tx, { contactId: id }, deletedAt);
  });
}

/**
 * Brings a deleted contact back where it was, in one transaction: in the lists (those still live)
 * and on the photos, albums and posts its deletion took it from (sync-design §10). An edge removed
 * on its own, before or after the deletion, stays removed.
 */
export async function restore(db: SyncDb, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [contact] = await readByIds(tx, schema.contacts, [id]);
    if (contact?.deletedAt == null) return;
    await repository.update(tx, id, { deletedAt: null });
    const liveLists = tx
      .select({ id: schema.contactLists.id })
      .from(schema.contactLists)
      .where(isNull(schema.contactLists.deletedAt));
    await contactListMembers.restoreWhere(
      tx,
      { contactId: id },
      contact.deletedAt,
      inArray(schema.contactListMembers.listId, liveLists),
    );
    await contactLinks.restoreWhere(tx, { contactId: id }, contact.deletedAt);
  });
}

/** Favorites or unfavorites a contact; favoritedAt is the time of the favoriting, null once unfavorited. */
export function toggleFavorite(db: SyncDb, id: string): Promise<void> {
  return toggle(db, id, 'isFavorite', (row) => ({ favoritedAt: row.isFavorite ? row.updatedAt : null }));
}

/**
 * The live contacts on these live, untrashed photos (`assetIds`) and on the other photos of the live
 * albums holding them: who a post of these photos is about. Those on the photos themselves first,
 * then by name.
 */
export async function readPhotoAndAlbumContacts(db: SyncDb, assetIds: string[]): Promise<ContactRow[]> {
  if (assetIds.length === 0) return [];
  const { contacts: c, contactLinks: l, assets: a } = schema;
  const isOnPhotos = sql<number>`max(${inJson(l.targetId, assetIds)})`;
  const rows = await db
    .select({ contact: c, isOnPhotos })
    .from(l)
    .innerJoin(a, and(eq(a.id, l.targetId), isNull(a.deletedAt)))
    .innerJoin(c, and(eq(c.id, l.contactId), isNull(c.deletedAt)))
    .where(
      and(
        eq(l.targetType, 'asset'),
        isNull(l.deletedAt),
        sql`(${inJson(l.targetId, assetIds)} or ${l.targetId} in ${albumAssetIdsOf(assetIds)})`,
      ),
    )
    .groupBy(c.id)
    .orderBy(desc(isOnPhotos), asc(sql`${c.name} collate nocase`), asc(c.id));
  return rows.map((row) => row.contact);
}
