import { CHAT_LIMITS } from '@squidbox/shared';

import type { MentionContact } from '@/features/post-mentions/mentionHandle';

/**
 * Whether a contact can be one of the chat's Mentions: its name fits what a turn may send
 * (CHAT_LIMITS.mention). A longer name is left out, never cut: a cut name could not be linked.
 */
export default function canBeChatMention(contact: Pick<MentionContact, 'name'>): boolean {
  return contact.name.length <= CHAT_LIMITS.mention;
}
