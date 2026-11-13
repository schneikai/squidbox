import { eq, inArray, isNull, max } from 'drizzle-orm';

import { nextUpdatedAt } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
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
