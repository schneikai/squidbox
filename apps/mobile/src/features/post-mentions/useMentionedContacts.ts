import { useMemo } from 'react';

import type { MentionContact } from './mentionHandle';
import type { MentionTextValue } from './mentionParts';

import useContactRows from '@/features/contact-list/useContactRows';

const NONE: ReadonlyMap<string, MentionContact> = new Map();

/**
 * The contacts the chips of `posts` mention, by id, live (contactQuery's `ids` scope): what a screen
 * that only shows posts needs for their chips' names, avatars and handles. Read again only when a
 * contact changes or other contacts are mentioned. `isRead` is false until the first read lands (the
 * map is empty till then; while other ids are read, it holds the last ones): a screen whose text goes
 * out waits for it. The editor, whose @ may mean anyone, reads every contact (useMentionContacts).
 */
export default function useMentionedContacts(posts: readonly MentionTextValue[] | undefined): {
  contactsById: ReadonlyMap<string, MentionContact>;
  isRead: boolean;
} {
  const ids = [
    ...new Set((posts ?? []).flatMap(({ mentions }) => (mentions ?? []).map(({ contactId }) => contactId))),
  ].sort();
  const contacts = useContactRows({ scope: { ids } });
  const contactsById = useMemo(
    () => (contacts && contacts.length > 0 ? new Map(contacts.map((contact) => [contact.id, contact])) : NONE),
    [contacts],
  );
  return { contactsById, isRead: contacts !== undefined };
}
