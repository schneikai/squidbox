import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { contactLinks, contactListMembers } from './membershipRepository';
import { makeRepository } from './repository';

const repository = makeRepository('contacts', schema.contacts);

// `remove` is the tombstone (deletedAt) alone; a contact the user deletes is `deleteContact`.
// The photo (`avatarFilename`, a file field) is uploaded by the sync before the record is pushed.
export const { create, update, remove, restore, toggle } = repository;

/** Deletes a contact: its tombstone, and it leaves every list, photo, album and post, in one write. */
export async function deleteContact(db: SyncDb, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await remove(tx, [id]);
    await contactListMembers.tombstoneWhere(tx, { contactId: id });
    await contactLinks.tombstoneWhere(tx, { contactId: id });
  });
}

/** Favorites or unfavorites a contact; favoritedAt is the time of the favoriting, null once unfavorited. */
export function toggleFavorite(db: SyncDb, id: string): Promise<void> {
  return toggle(db, id, 'isFavorite', (row) => ({ favoritedAt: row.isFavorite ? row.updatedAt : null }));
}
