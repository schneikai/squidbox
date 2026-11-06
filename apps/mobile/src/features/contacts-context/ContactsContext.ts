import type { ContactLinkRecord, ContactListRecord, ContactPlace, ContactRecord } from '@squidbox/shared';
import { createContext } from 'react';

// The contacts on one photo, album or post (contact_links' parent).
export type ContactTarget = Pick<ContactLinkRecord, 'targetType' | 'targetId'>;

// The children that join a parent and those that leave it (membershipRepository's `change`).
export type MembershipChange = { added: string[]; removed: string[] };

export type ContactsContextValue = {
  addContact: (
    fields: Partial<ContactRecord>,
    options?: { avatarUri?: string | null; listIds?: string[] },
  ) => Promise<{ contact: ContactRecord; avatarError: unknown }>;
  toggleFavoriteContact: (id: string) => Promise<void>;
  setAvatarAsync: (id: string, sourceUri: string) => Promise<void>;
  removeAvatar: (id: string) => Promise<void>;
  changePlace: (id: string, from: ContactPlace | null, to: ContactPlace | null) => Promise<void>;
  setContactDeleted: (id: string) => Promise<void>;
  addList: (name: string) => Promise<ContactListRecord>;
  updateList: (id: string, fields: Partial<ContactListRecord>) => Promise<void>;
  setListDeleted: (id: string) => Promise<void>;
  addToLists: (contactIds: string[], listIds: string[]) => Promise<void>;
  changeListContacts: (listId: string, change: MembershipChange) => Promise<void>;
  changeTargetContacts: (target: ContactTarget, change: MembershipChange) => Promise<void>;
};

const ContactsContext = createContext<ContactsContextValue | null>(null);

export default ContactsContext;
