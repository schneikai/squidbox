import { contactCollection, contactListCollection } from '@squidbox/shared';
import { useMemo } from 'react';

import ContactsContext from './ContactsContext';

import makeAvatarAsync from '@/features/contact-avatar/makeAvatarAsync';
import useLibrary from '@/library/useLibrary';
import * as lists from '@/sync/contactListsRepository';
import * as contacts from '@/sync/contactsRepository';
import { getDb } from '@/sync/db/client';
import * as schema from '@/sync/db/schema';
import { contactLinks, contactListMembers } from '@/sync/membershipRepository';
import { readByIds } from '@/sync/readByIds';
import { requestSync } from '@/sync/worker';
import { deleteAvatar } from '@/utils/assets/assetStorage';
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
};
const LIST_DEFAULTS = { notes: null, position: null };

// The contact and contact list writes. Membership lives in the contact_list_members edge collection
// and the contacts on a photo, album or post in contact_links (membershipRepository); a user action
// that writes a record and its edges commits once. Screens read through their own live queries
// (contactQuery, contactListQuery).
export default function ContactsProvider({ children }) {
  const { paths: library } = useLibrary();
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
      // A new photo gets a new name (`avatar-<id>-<n>.jpg`, the next n), so a device holding the old
      // one never shows it for the new; the sync uploads it before it pushes the contact.
      setAvatarAsync: async (id, sourceUri) => {
        const [contact] = await readByIds(db, schema.contacts, [id]);
        if (!contact) return;
        const avatarFilename = `avatar-${id}-${avatarNumber(contact.avatarFilename) + 1}.jpg`;
        await makeAvatarAsync(sourceUri, avatarFilename, library);
        await written((tx) => contacts.update(tx, id, { avatarFilename }));
        if (contact.avatarFilename) deleteAvatar(contact.avatarFilename, library);
      },
      removeAvatar: async (id) => {
        const [contact] = await readByIds(db, schema.contacts, [id]);
        if (!contact?.avatarFilename) return;
        await written((tx) => contacts.update(tx, id, { avatarFilename: null }));
        deleteAvatar(contact.avatarFilename, library);
      },
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
      // Makes exactly these contacts the list's: the ones added join, the ones left out leave.
      setListContacts: (listId, contactIds) =>
        written((tx) => contactListMembers.set(tx, { listId }, contactIds, getNewItemId)),
      removeFromList: (listId, contactId) => written((tx) => contactListMembers.remove(tx, { listId }, [contactId])),
      // Puts exactly these contacts on the photo, album or post: the ones added get a link, the ones
      // left out lose theirs. The only way a link is removed.
      setTargetContacts: ({ targetType, targetId }, contactIds) =>
        written((tx) => contactLinks.set(tx, { targetType, targetId }, contactIds, getNewItemId)),
    };
  }, [library]);

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

// The n of `avatar-<id>-<n>.jpg`, 0 without a photo.
function avatarNumber(avatarFilename) {
  return Number(avatarFilename?.match(/-(\d+)\.jpg$/)?.[1] ?? 0);
}
