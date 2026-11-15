import type { Channel } from '@squidbox/shared';

import mentionHandle, { type MentionContact } from './mentionHandle';
import mentionLabel from './mentionLabel';
import mentionParts, { type MentionTextValue } from './mentionParts';

/** A text as a channel gets it, and the mentioned contacts that have no handle there. */
export type ChannelText = { text: string; missing: MentionContact[] };

/**
 * `value`'s text as `channel` gets it: each valid mention (mentionParts) as it reads there
 * (mentionLabel: `@` and the live contact's handle, its name without one, a deleted contact's stored
 * name). `missing` lists the live contacts without a handle there, once each, in the order they are
 * mentioned.
 */
export default function textForChannel(
  value: MentionTextValue,
  contactsById: ReadonlyMap<string, MentionContact>,
  channel: Pick<Channel, 'handleField'>,
): ChannelText {
  const missing = new Map<string, MentionContact>();
  const text = mentionParts(value.text, value.mentions)
    .map((part) => {
      if (part.kind === 'text') return part.text;
      const contact = contactsById.get(part.mention.contactId);
      if (contact && !mentionHandle(contact, channel.handleField)) missing.set(contact.id, contact);
      return mentionLabel(part.mention, contactsById, channel);
    })
    .join('');
  return { text, missing: [...missing.values()] };
}
