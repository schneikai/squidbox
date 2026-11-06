import { and, isNotNull, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { makeRepository } from './repository';

const l = schema.contactLists;

// The contact lists. Membership lives in the contact_list_members edge collection (membershipRepository).
export const { create, update, updateAll, remove } = makeRepository('contact_lists', l);

/**
 * Pins the list to the top of Contacts in place of Favorites (null for Favorites again), in one
 * write: its pinnedAt is the time of the pinning, and every other pinned list, read in the same
 * write, is unpinned (two devices that pinned one each before they synced leave both pinned, and the
 * later shows: pinnedList).
 */
export async function pin(db: SyncDb, id: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: l.id })
      .from(l)
      .where(and(isNotNull(l.pinnedAt), isNull(l.deletedAt)));
    const pinned = rows.map((row) => row.id);
    const unpinned = pinned.filter((listId) => listId !== id);
    if (unpinned.length) await updateAll(tx, unpinned, { pinnedAt: null });
    if (id && !pinned.includes(id)) await update(tx, id, { pinnedAt: Date.now() });
  });
}
