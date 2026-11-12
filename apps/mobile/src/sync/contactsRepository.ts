import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { contactLinks, contactListMembers } from './membershipRepository';
import { makeRepository } from './repository';

// The photo (`avatarFilename`, a file field) is uploaded by the sync before the record is pushed, its
// tombstone included (sync-design §6).
const repository = makeRepository('contacts', schema.contacts);
export const { create, update, toggle, restore } = repository;

/**
 * Tombstones these contacts and, in the same transaction, their list memberships and the links to
 * the photos they are on: one read and one write per contact and edge collection, which suits the
 * one-at-a-time delete the app has (a bulk delete would read the edges of all ids with `inJson`).
 */
export async function remove(db: SyncDb, ids: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await repository.remove(tx, ids);
    for (const id of ids) {
      await contactListMembers.tombstoneWhere(tx, { contactId: id });
      await contactLinks.tombstoneWhere(tx, { contactId: id });
    }
  });
}
