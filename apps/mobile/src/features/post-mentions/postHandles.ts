import type { PostMention } from '@squidbox/shared';
import { CONTACT_HANDLE_FIELDS } from '@squidbox/shared';

import mentionHandle, { type MentionContact } from './mentionHandle';
import mentionParts from './mentionParts';

import extractHandles from '@/lib/extractHandles';

/** A post's text and its mentions, as the mention reads give them. */
export type PostWithMentions = { text: string; mentions: PostMention[] | null };

/**
 * The @handles these posts mention, those used most first (extractHandles): each post's typed
 * @handles, and for each of its chips of a live contact (`contactsById`), every handle that contact
 * has. A chip of a deleted contact adds none.
 */
export default function postHandles(
  posts: readonly PostWithMentions[],
  contactsById: ReadonlyMap<string, MentionContact>,
): string[] {
  const texts = posts.flatMap(({ text, mentions }) => {
    const chips = mentionParts(text, mentions).flatMap((part) => {
      const contact = part.kind === 'mention' ? contactsById.get(part.mention.contactId) : undefined;
      if (!contact) return [];
      return CONTACT_HANDLE_FIELDS.flatMap((field) => {
        const handle = mentionHandle(contact, field);
        return handle ? [`@${handle}`] : [];
      });
    });
    return [text, ...new Set(chips)];
  });
  return extractHandles(texts);
}
