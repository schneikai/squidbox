import { CONTACT_HANDLE_FIELDS, contactCollection, contactListCollection } from '@squidbox/shared';
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
  ...Object.fromEntries(CONTACT_HANDLE_FIELDS.map((field) => [field, null])),
  phoneNumber: null,
  places: [],
  avatarFilename: null,
};
const LIST_DEFAULTS = { notes: null };

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
    // Sets the contact's photo name, from the contact read in the same write: the name it replaced
    // (null for none), or undefined for a contact that is gone.
    function swapAvatar(id, avatarFilename) {
      return written(async (tx) => {
        const [contact] = await readByIds(tx, schema.contacts, [id]);
        if (!contact) return undefined;
        if (contact.avatarFilename !== avatarFilename) await contacts.update(tx, id, { avatarFilename });
        return contact.avatarFilename;
      });
    }
    return {
      // A new contact with its photo (made from `avatarUri` first: a record never names a file that
      // isn't there) and in `listIds`, in one write. A photo that can't be made is returned as
      // `avatarError`, and the contact is added without it.
      addContact: async (fields, { avatarUri, listIds = [] } = {}) => {
        const record = newRecord(contactCollection, CONTACT_DEFAULTS, fields);
        let avatarFilename = null;
        let avatarError = null;
        if (avatarUri) {
          try {
            avatarFilename = newAvatarFilename(record.id);
            await makeAvatarAsync(avatarUri, avatarFilename, library);
          } catch (error) {
            avatarFilename = null;
            avatarError = error;
          }
        }
        const contact = await written(async (tx) => {
          const created = await contacts.create(tx, { ...record, avatarFilename });
          await contactListMembers.addToEach(
            tx,
            listIds.map((listId) => ({ listId })),
            [created.id],
            getNewItemId,
          );
          return created;
        });
        return { contact, avatarError };
      },
      // favoritedAt is the time of the favoriting, null once unfavorited.
      toggleFavoriteContact: (id) =>
        written((tx) =>
          contacts.toggle(tx, id, 'isFavorite', (row) => ({ favoritedAt: row.isFavorite ? row.updatedAt : null })),
        ),
      // A new photo gets a new name (newAvatarFilename), so a device holding the old one never shows
      // it for the new; the sync uploads it before it pushes the contact.
      // The photo it replaces is read in the same write, so of two quick changes each deletes the one
      // it replaced, and none is left behind.
      setAvatarAsync: async (id, sourceUri) => {
        const avatarFilename = newAvatarFilename(id);
        await makeAvatarAsync(sourceUri, avatarFilename, library);
        const replaced = await swapAvatar(id, avatarFilename);
        if (replaced === undefined)
          deleteAvatar(avatarFilename, library); // the contact is gone
        else if (replaced) deleteAvatar(replaced, library);
      },
      removeAvatar: async (id) => {
        const replaced = await swapAvatar(id, null);
        if (replaced) deleteAvatar(replaced, library);
      },
      // The contact leaves its lists and the photos, albums and posts it is on with it.
      setContactDeleted: (id) =>
        written(async (tx) => {
          await contacts.remove(tx, [id]);
          await contactListMembers.tombstoneWhere(tx, { contactId: id });
          await contactLinks.tombstoneWhere(tx, { contactId: id });
        }),
      addList: (name) => written((tx) => lists.create(tx, newRecord(contactListCollection, LIST_DEFAULTS, { name }))),
      updateList: (id, fields) => written((tx) => lists.update(tx, id, fields)),
      setListDeleted: (id) =>
        written(async (tx) => {
          await lists.remove(tx, [id]);
          await contactListMembers.tombstoneWhere(tx, { listId: id });
        }),
      addToLists: (contactIds, listIds) =>
        written((tx) =>
          contactListMembers.addToEach(
            tx,
            listIds.map((listId) => ({ listId })),
            contactIds,
            getNewItemId,
          ),
        ),
      // `{ added, removed }`: the contacts that join the list and those that leave it; the others
      // stay as they are, so another device's change meanwhile is kept.
      changeListContacts: (listId, change) =>
        written((tx) => contactListMembers.change(tx, { listId }, change, getNewItemId)),
      removeFromList: (listId, contactId) => written((tx) => contactListMembers.remove(tx, { listId }, [contactId])),
      // `{ added, removed }`: the contacts put on the photo, album or post and those taken off it;
      // the others stay as they are. The only way a link is removed.
      changeTargetContacts: ({ targetType, targetId }, change) =>
        written((tx) => contactLinks.change(tx, { targetType, targetId }, change, getNewItemId)),
    };
  }, [library]);

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

// A contact's photo's name, new for every photo: `avatar-<contactId>-<new id>.jpg`.
function newAvatarFilename(contactId) {
  return `avatar-${contactId}-${getNewItemId()}.jpg`;
}
