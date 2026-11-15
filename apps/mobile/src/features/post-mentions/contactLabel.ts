import type { Channel } from '@squidbox/shared';

import mentionHandle, { type MentionContact } from './mentionHandle';

/** How a contact's chip reads: its name, or on `channel` its `@handle` there (mentionHandle) and its name without one. */
export default function contactLabel(contact: MentionContact, channel?: Pick<Channel, 'handleField'>): string {
  const handle = channel && mentionHandle(contact, channel.handleField);
  return handle ? `@${handle}` : contact.name;
}
