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
      setAvatarAsync: async (id, sourceUri) => {
        const [contact] = await readByIds(db, schema.contacts, [id]);
        if (!contact) return;
        const avatarFilename = newAvatarFilename(id);
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

// A contact's photo's name, new for every photo: `avatar-<contactId>-<new id>.jpg`.
function newAvatarFilename(contactId) {
  return `avatar-${contactId}-${getNewItemId()}.jpg`;
}
