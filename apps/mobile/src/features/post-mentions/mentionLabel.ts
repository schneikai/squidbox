import type { Channel, PostMention } from '@squidbox/shared';

import contactLabel from './contactLabel';
import type { MentionContact } from './mentionHandle';

/**
 * How a mention reads: as its live contact's chip does (contactLabel), the stored name once the
 * contact is deleted.
 */
export default function mentionLabel(
  mention: PostMention,
  contactsById: ReadonlyMap<string, MentionContact>,
  channel?: Pick<Channel, 'handleField'>,
): string {
  const contact = contactsById.get(mention.contactId);
  return contact ? contactLabel(contact, channel) : mention.name;
}
