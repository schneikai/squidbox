import { useMemo } from 'react';

import type { MentionContact } from './mentionHandle';

import useContactRows from '@/features/contact-list/useContactRows';

/**
 * Every contact by id, live, for the mentions on a screen: their chips' names and avatars, the
 * handles they go out as, who an @ may mean. Read once per screen and handed down; an empty map
 * while reading.
 */
export default function useMentionContacts(): ReadonlyMap<string, MentionContact> {
  const contacts = useContactRows({});
  return useMemo(() => new Map((contacts ?? []).map((contact) => [contact.id, contact])), [contacts]);
}
