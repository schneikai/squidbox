import { useMemo } from 'react';

import type { MentionContact } from './mentionHandle';
import type { MentionTextValue } from './mentionParts';
import readMentionContacts from './readMentionContacts';

import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const NONE: ReadonlyMap<string, MentionContact> = new Map();

/**
 * The contacts the chips of `posts` mention, by id, live (readMentionContacts): what a screen that
 * only shows posts needs for their chips' names, avatars and handles. Read again only when a contact
 * changes or other contacts are mentioned; empty while reading. The editor, whose @ may mean anyone,
 * reads every contact (useMentionContacts).
 */
export default function useMentionedContacts(
  posts: readonly MentionTextValue[] | undefined,
): ReadonlyMap<string, MentionContact> {
  const ids = [...new Set((posts ?? []).flatMap(({ mentions }) => (mentions ?? []).map(({ contactId }) => contactId)))]
    .sort()
    .join();
  // The read of the posts whose ids these are: the same ids read the same contacts.
  const contacts = useLiveQuery(
    async (db) => [...(await readMentionContacts(db, posts ?? [])).values()],
    [schema.contacts],
    [ids],
  );
  return useMemo(
    () => (contacts && contacts.length > 0 ? new Map(contacts.map((contact) => [contact.id, contact])) : NONE),
    [contacts],
  );
}
