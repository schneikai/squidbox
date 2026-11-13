import {
  CONTACT_HANDLE_FIELDS,
  contactCollection,
  contactListCollection,
  type ContactListRecord,
  type ContactRecord,
} from '@squidbox/shared';
import { type ReactNode, useMemo } from 'react';

import ContactsContext, { type ContactsContextValue } from './ContactsContext';

import useOpenLibrary from '@/library/useOpenLibrary';
import makeAvatarAsync from '@/providers/contacts/makeAvatarAsync';
import * as lists from '@/sync/contactListsRepository';
import * as contacts from '@/sync/contactsRepository';
import { getDb } from '@/sync/db/client';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { contactLinks, contactListMembers } from '@/sync/membershipRepository';
import { addToPhotos, removeFromPhotos } from '@/sync/photoContacts';
import { builtInContactList } from '@/sync/queries/builtInContactLists';
import { readByIds } from '@/sync/readByIds';
import readPhotoIdsOf from '@/sync/readPhotoIdsOf';
import { requestSync } from '@/sync/worker';
import { deleteAvatar } from '@/utils/assets/assetStorage';
import placesChanged from '@/utils/contacts/placesChanged';
import getNewItemId from '@/utils/getNewItemId';
import newRecord from '@/utils/newRecord';

const CONTACT_DEFAULTS: Partial<ContactRecord> = {
  isFavorite: false,
  favoritedAt: null,
  notes: null,
  ...Object.fromEntries(CONTACT_HANDLE_FIELDS.map((field) => [field, null])),
  phoneNumber: null,
  places: [],
  avatarFilename: null,
};
const LIST_DEFAULTS: Partial<ContactListRecord> = { notes: null };

type ContactsProviderProps = { children: ReactNode };

// The contact and contact list writes. Membership lives in the contact_list_members edge collection
// and the contacts on a photo in contact_links (membershipRepository, photoContacts); a user action
// that writes a record and its edges commits once. Screens read through their own live queries
// (contactQuery, contactListQuery).
export default function ContactsProvider({ children }: ContactsProviderProps) {
  const { paths: library, userId } = useOpenLibrary();
  const value = useMemo<ContactsContextValue>(() => {
    const db = getDb();
    async function written<T>(write: (tx: SyncDb) => Promise<T>): Promise<T> {
      const result = await db.transaction(write);
      requestSync();
      return result;
    }
    // Sets the contact's photo name, from the contact read in the same write: the name it replaced
    // (null for none), or undefined for a contact that is gone.
    function swapAvatar(id: string, avatarFilename: string | null): Promise<string | null | undefined> {
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
        let avatarFilename: string | null = null;
        let avatarError: unknown = null;
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
      toggleFavoriteContact: (id) => written((tx) => contacts.toggleFavorite(tx, id)),
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
      // Takes the place a sheet opened with (`from`, null for a new one) to `to` (null removes it) in
      // the contact's places as stored now, read in the same write (placesChanged).
      changePlace: (id, from, to) =>
        written(async (tx) => {
          const [contact] = await readByIds(tx, schema.contacts, [id]);
          if (contact) await contacts.update(tx, id, { places: placesChanged(contact.places, from, to) });
        }),
      setContactDeleted: (id) => written((tx) => contacts.deleteContact(tx, id)),
      // Brings a deleted contact back (Deleted's rows) where it was: its photo, lists and tags.
      restoreContact: (id) => written((tx) => contacts.restore(tx, id)),
      addList: (name) => written((tx) => lists.create(tx, newRecord(contactListCollection, LIST_DEFAULTS, { name }))),
      updateList: (id, fields) => written((tx) => lists.update(tx, id, fields)),
      setListDeleted: (id) =>
        written(async (tx) => {
          await lists.remove(tx, [id]);
          await contactListMembers.tombstoneWhere(tx, { listId: id });
        }),
      pinList: (id) => {
        const builtIn = builtInContactList(id ?? undefined);
        const target = !id || builtIn?.id === 'favorites' ? null : builtIn ? { builtInId: id } : { listId: id };
        return written((tx) => lists.pin(tx, target, userId));
      },
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
      // `{ added, removed }`: the contacts put on the photo and those taken off it; the others stay
      // as they are. The only way a link is removed.
      changePhotoContacts: (assetId, change) =>
        written((tx) => contactLinks.change(tx, { targetType: 'asset', targetId: assetId }, change, getNewItemId)),
      // Puts the contacts on every one of the photos; those already on one stay as they are.
      addContactsToPhotos: (assetIds, contactIds) =>
        written((tx) => addToPhotos(tx, assetIds, contactIds, getNewItemId)),
      // Puts the added contacts on every photo of the album or post, as it holds them when this
      // writes, and takes the removed ones off them all, in one write.
      changeContactsOnPhotosOf: (of, { added, removed }) =>
        written(async (tx) => {
          const photoIds = await readPhotoIdsOf(tx, of);
          await removeFromPhotos(tx, photoIds, removed);
          await addToPhotos(tx, photoIds, added, getNewItemId);
        }),
    };
  }, [library, userId]);

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

// A contact's photo's name, new for every photo: `avatar-<contactId>-<new id>.jpg`.
function newAvatarFilename(contactId: string): string {
  return `avatar-${contactId}-${getNewItemId()}.jpg`;
}
