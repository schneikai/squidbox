import type { Channel } from '@squidbox/shared';

import MentionChip from './MentionChip';
import type { MentionContact } from './mentionHandle';
import mentionLabel from './mentionLabel';
import mentionParts, { type MentionTextValue } from './mentionParts';

type MentionRunsProps = {
  value: MentionTextValue;
  contactsById: ReadonlyMap<string, MentionContact>;
  /** The channel a copy is for: its chips read as the contacts' handles there. */
  channel?: Pick<Channel, 'handleField'>;
  /** A tap on a live contact's chip; without it chips take none. */
  onPressMention?: (contactId: string) => void;
  /** The size of the text the runs stand in (MentionChip's). */
  size?: 'regular' | 'small';
};

/**
 * A text's pieces, to stand inside a Text: its plain runs, and each valid mention (mentionParts) a
 * chip in the line (MentionChip, labelled as mentionLabel reads it). A chip of a deleted contact
 * shows its stored name and takes no tap. MentionText wraps them in reading text; a card or bubble
 * puts them in its own.
 */
export default function MentionRuns({ value, contactsById, channel, onPressMention, size }: MentionRunsProps) {
  const parts = mentionParts(value.text, value.mentions);

  return (
    <>
      {parts.map((part) => {
        if (part.kind === 'text') return part.text;
        const contact = contactsById.get(part.mention.contactId);
        return (
          <MentionChip
            key={part.mention.location}
            label={mentionLabel(part.mention, contactsById, channel)}
            contact={contact ?? { name: part.mention.name }}
            onPress={contact && onPressMention ? () => onPressMention(contact.id) : undefined}
            size={size}
          />
        );
      })}
    </>
  );
}
