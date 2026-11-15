import { CHAT_LIMITS } from '@squidbox/shared';

import canBeChatMention from './canBeChatMention';

import type { MentionContact } from '@/features/post-mentions/mentionHandle';

/**
 * The contacts the chat shows and sends: those the Mentions sheet added (`added`) first, so the limit
 * never cuts them, then those found for the posts (`found`, readMentions') without the ones it took
 * off (`removedIds`), each once, only those that can be a chat mention (canBeChatMention), at most
 * CHAT_LIMITS.mentions.
 */
export default function chatMentions(
  found: readonly MentionContact[],
  added: readonly MentionContact[],
  removedIds: readonly string[],
): MentionContact[] {
  const removed = new Set(removedIds);
  const seen = new Set<string>();
  return [...added, ...found]
    .filter((contact) => {
      if (removed.has(contact.id) || seen.has(contact.id) || !canBeChatMention(contact)) return false;
      seen.add(contact.id);
      return true;
    })
    .slice(0, CHAT_LIMITS.mentions);
}
