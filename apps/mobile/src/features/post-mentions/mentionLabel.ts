import type { Channel, PostMention } from '@squidbox/shared';

import mentionHandle, { type MentionContact } from './mentionHandle';

/**
 * How a mention reads: its live contact's name, or on `channel` the contact's `@handle` there
 * (mentionHandle) and its name without one; the stored name once the contact is deleted.
 */
export default function mentionLabel(
  mention: PostMention,
  contactsById: ReadonlyMap<string, MentionContact>,
  channel?: Pick<Channel, 'handleField'>,
): string {
  const contact = contactsById.get(mention.contactId);
  if (!contact) return mention.name;
  const handle = channel && mentionHandle(contact, channel.handleField);
  return handle ? `@${handle}` : contact.name;
}
