import { and, isNotNull, isNull } from 'drizzle-orm';

import { pinBuiltInList } from './contactSettingsRepository';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { makeRepository } from './repository';

const l = schema.contactLists;

// The contact lists. Membership lives in the contact_list_members edge collection (membershipRepository).
export const { create, update, updateAll, remove } = makeRepository('contact_lists', l);

/** What to pin to the top of Contacts: a list of the user's, a built-in one, or null for Favorites. */
export type PinTarget = { listId: string } | { builtInId: string } | null;

/**
 * Pins `target` to the top of Contacts in place of Favorites, in one write: a list's pinnedAt is the
 * time of the pinning, a built-in list's is kept in the user's contact settings (`userId`'s), and
 * whatever else was pinned, read in the same write, is unpinned (two devices that pinned one each
 * before they synced leave both pinned, and the later shows: pinnedList).
 */
export async function pin(db: SyncDb, target: PinTarget, userId: string | null): Promise<void> {
  const id = target && 'listId' in target ? target.listId : null;
  const builtInId = target && 'builtInId' in target ? target.builtInId : null;
  await db.transaction(async (tx) => {
    if (userId) await pinBuiltInList(tx, userId, builtInId);
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
