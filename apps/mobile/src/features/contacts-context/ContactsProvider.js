import { contactCollection, contactListCollection } from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { useMemo } from 'react';

import ContactsContext from './ContactsContext';

import * as lists from '@/sync/contactListsRepository';
import * as contacts from '@/sync/contactsRepository';
import { getDb, schema } from '@/sync/db/client';
import { contactLinks, contactListMembers } from '@/sync/membershipRepository';
import { requestSync } from '@/sync/worker';
import getNewItemId from '@/utils/getNewItemId';
import newRecord from '@/utils/newRecord';

const CONTACT_DEFAULTS = {
  isFavorite: false,
  favoritedAt: null,
  notes: null,
  xHandle: null,
  blueskyHandle: null,
  onlyFansHandle: null,
  jffHandle: null,
  phoneNumber: null,
  places: [],
  avatarFilename: null,
  isAvatarSynced: false,
};
const LIST_DEFAULTS = { notes: null, position: null };

// The contact and contact list writes. Membership lives in the contact_list_members edge collection
// and the contacts on a photo, album or post in contact_links (membershipRepository); a user action
// that writes a record and its edges commits once. Screens read through their own live queries
// (contactQuery, contactListQuery).
export default function ContactsProvider({ children }) {
  const value = useMemo(() => {
    const db = getDb();
    async function written(write) {
      const result = await db.transaction(write);
      requestSync();
      return result;
    }
    return {
      addContact: (fields) =>
        written((tx) => contacts.create(tx, newRecord(contactCollection, CONTACT_DEFAULTS, fields))),
      updateContact: (id, fields) => written((tx) => contacts.update(tx, id, fields)),
      // favoritedAt is the time of the favoriting, null once unfavorited.
      toggleFavoriteContact: (id) =>
        written((tx) =>
          contacts.toggle(tx, id, 'isFavorite', (row) => ({ favoritedAt: row.isFavorite ? row.updatedAt : null })),
        ),
      // The contact leaves its lists and the photos, albums and posts it is on with it.
      setContactDeleted: (id) =>
        written(async (tx) => {
          await contacts.remove(tx, [id]);
          await contactListMembers.tombstoneChild(tx, id);
          await contactLinks.tombstoneChild(tx, id);
        }),
      addList: (name) => written((tx) => lists.create(tx, newRecord(contactListCollection, LIST_DEFAULTS, { name }))),
      updateList: (id, fields) => written((tx) => lists.update(tx, id, fields)),
      setListDeleted: (id) =>
        written(async (tx) => {
          await lists.remove(tx, [id]);
          await contactListMembers.tombstoneParent(tx, { listId: id });
        }),
      addToLists: (contactIds, listIds) =>
        written(async (tx) => {
          for (const listId of listIds) await contactListMembers.add(tx, { listId }, contactIds, getNewItemId);
        }),
      removeFromList: (listId, contactId) => written((tx) => contactListMembers.remove(tx, { listId }, [contactId])),
      // Puts exactly these contacts on the photo, album or post: the ones added get a link, the ones
      // left out lose theirs. The only way a link is removed.
      setTargetContacts: (target, contactIds) =>
        written(async (tx) => {
          const live = await tx
            .select({ contactId: schema.contactLinks.contactId })
            .from(schema.contactLinks)
            .where(
              and(
                eq(schema.contactLinks.targetType, target.targetType),
                eq(schema.contactLinks.targetId, target.targetId),
                isNull(schema.contactLinks.deletedAt),
              ),
            );
          const wanted = new Set(contactIds);
          const linked = new Set(live.map((row) => row.contactId));
          const parent = { targetType: target.targetType, targetId: target.targetId };
          await contactLinks.remove(
            tx,
            parent,
            [...linked].filter((id) => !wanted.has(id)),
          );
          await contactLinks.add(
            tx,
            parent,
            [...wanted].filter((id) => !linked.has(id)),
            getNewItemId,
          );
        }),
    };
  }, []);

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}
