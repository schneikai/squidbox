import {
  CONTACT_HANDLE_FIELDS,
  contactCollection,
  contactListCollection,
  type ContactListRecord,
  type ContactRecord,
} from '@squidbox/shared';
import { sql } from 'drizzle-orm';
import { type ReactNode, useMemo } from 'react';

import ContactsContext, { type ContactsContextValue } from './ContactsContext';

import assetQuery from '@/features/asset-list/assetQuery';
import makeAvatarAsync from '@/features/contact-avatar/makeAvatarAsync';
import { placesChanged } from '@/features/contact-detail/contactFields';
import { builtInContactList } from '@/features/contact-list/builtInContactLists';
import useOpenLibrary from '@/library/useOpenLibrary';
import { postThreadAssetIds } from '@/sync/assetSql';
import * as lists from '@/sync/contactListsRepository';
import * as contacts from '@/sync/contactsRepository';
import { getDb } from '@/sync/db/client';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { contactLinks, contactListMembers } from '@/sync/membershipRepository';
import { readByIds } from '@/sync/readByIds';
import { requestSync } from '@/sync/worker';
import { deleteAvatar } from '@/utils/assets/assetStorage';
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
// and the contacts on a photo, album or post in contact_links (membershipRepository); a user action
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
      // Takes the place a sheet opened with (`from`, null for a new one) to `to` (null removes it) in
      // the contact's places as stored now, read in the same write (placesChanged).
      changePlace: (id, from, to) =>
        written(async (tx) => {
          const [contact] = await readByIds(tx, schema.contacts, [id]);
          if (contact) await contacts.update(tx, id, { places: placesChanged(contact.places, from, to) });
        }),
      // The contact leaves its lists and the photos, albums and posts it is on with it.
      setContactDeleted: (id) =>
        written(async (tx) => {
          await contacts.remove(tx, [id]);
          await contactListMembers.tombstoneWhere(tx, { contactId: id });
          await contactLinks.tombstoneWhere(tx, { contactId: id });
        }),
      // Brings a deleted contact back (Deleted's rows), with its photo; the lists and the photos,
      // albums and posts it left when it was deleted stay as they are now.
      restoreContact: (id) => written((tx) => contacts.update(tx, id, { deletedAt: null })),
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
      // `{ added, removed }`: the contacts put on the photo, album or post and those taken off it;
      // the others stay as they are. The only way a link is removed.
      changeTargetContacts: ({ targetType, targetId }, change) =>
        written((tx) => contactLinks.change(tx, { targetType, targetId }, change, getNewItemId)),
      // Puts the contacts on every one of the photos; those already on one stay as they are.
      addContactsToPhotos: (assetIds, contactIds) => written((tx) => addToPhotos(tx, assetIds, contactIds)),
      // Puts the added contacts on every photo the album shows, as it holds them when this writes, and
      // takes the removed ones off them all (removeFromPhotosOf), in one write.
      changeAlbumPhotosContacts: (albumId, { added, removed }) =>
        written(async (tx) => {
          if (removed.length) await removeFromPhotosOf(tx, { targetType: 'album', targetId: albumId }, removed);
          if (added.length) await addToPhotos(tx, await assetQuery({ scope: { albumId } }).ids(tx), added);
        }),
      removeContactsFromPhotosOf: (target, contactIds) => written((tx) => removeFromPhotosOf(tx, target, contactIds)),
    };
  }, [library, userId]);

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

// The photos of a post and of its thread's posts, through live edges.
async function postPhotoIds(tx: SyncDb, postId: string): Promise<string[]> {
  const rows = await tx.all<{ asset_id: string }>(sql`select distinct asset_id from ${postThreadAssetIds(postId)}`);
  return rows.map((row) => row.asset_id);
}

// Takes the contacts off every photo of the album or post (a thread's posts too), and off the album
// or post itself (a link from before only photos were tagged).
async function removeFromPhotosOf(
  tx: SyncDb,
  target: { targetType: 'album' | 'post'; targetId: string },
  contactIds: string[],
): Promise<void> {
  const photoIds =
    target.targetType === 'album'
      ? await assetQuery({ scope: { albumId: target.targetId } }).ids(tx)
      : await postPhotoIds(tx, target.targetId);
  const photos = photoIds.map((targetId) => ({ targetType: 'asset', targetId }));
  await contactLinks.removeFromEach(tx, [...photos, target], contactIds);
}

function addToPhotos(tx: SyncDb, assetIds: string[], contactIds: string[]): Promise<void> {
  const photos = assetIds.map((targetId) => ({ targetType: 'asset', targetId }));
  return contactLinks.addToEach(tx, photos, contactIds, getNewItemId);
}

// A contact's photo's name, new for every photo: `avatar-<contactId>-<new id>.jpg`.
function newAvatarFilename(contactId: string): string {
  return `avatar-${contactId}-${getNewItemId()}.jpg`;
}
