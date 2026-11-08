import { type ContactListSummary, LIST_STACK } from './contactListQuery';
import contactQuery, { type ContactScope } from './contactQuery';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';

/**
 * The lists the app keeps itself, like the built-in albums: Favorites, Tagged (the contacts on a
 * photo, album or post) and Deleted. Each opens at `/contact-list/<id>`; no list record has these ids
 * (theirs are uuids). `emptyTitle` is its screen's empty state; `isSortable` whether it takes the
 * contacts' sort (Favorites keep the order they were favorited in, Deleted the order they were
 * deleted in, newest first).
 */
export const BUILT_IN_CONTACT_LISTS = [
  { id: 'favorites', name: 'Favorites', scope: 'favorites', emptyTitle: 'No favorites yet', isSortable: false },
  { id: 'tagged', name: 'Tagged', scope: 'tagged', emptyTitle: 'No one is tagged yet', isSortable: true },
  { id: 'deleted', name: 'Deleted', scope: 'deleted', emptyTitle: 'No deleted contacts', isSortable: false },
] as const satisfies { id: string; name: string; scope: ContactScope; emptyTitle: string; isSortable: boolean }[];

export type BuiltInContactList = (typeof BUILT_IN_CONTACT_LISTS)[number];

/** The built-in list with this id, or undefined for a list of the user's. */
export function builtInContactList(id: string | undefined): BuiltInContactList | undefined {
  return BUILT_IN_CONTACT_LISTS.find((list) => list.id === id);
}

/** A built-in list as its row in the Lists screen shows it (ContactListRows). */
export type BuiltInContactListSummary = Pick<
  ContactListSummary,
  'id' | 'name' | 'createdAt' | 'memberCount' | 'firstMembers'
>;

/**
 * The built-in lists, each with its count and first LIST_STACK contacts (its scope's order), and `createdAt` 0, so
 * Recently added puts them last, read in one transaction; `tables` → what a live read watches.
 */
export const builtInContactListsQuery = {
  descriptor: {},
  // Tagged counts the contacts on untrashed photos.
  tables: [schema.contacts, schema.contactLinks, schema.assets],
  read(db: SyncDb): Promise<BuiltInContactListSummary[]> {
    return db.transaction(async (tx) => {
      const summaries: BuiltInContactListSummary[] = [];
      for (const list of BUILT_IN_CONTACT_LISTS) {
        const { rows, count } = await contactQuery({ scope: list.scope }).read(tx, { limit: LIST_STACK });
        summaries.push({
          id: list.id,
          name: list.name,
          createdAt: 0,
          memberCount: count,
          firstMembers: rows.map(({ id, name, avatarFilename }) => ({ id, name, avatarFilename })),
        });
      }
      return summaries;
    });
  },
};
