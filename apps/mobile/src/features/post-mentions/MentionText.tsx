import type { Channel } from '@squidbox/shared';

import MentionChip from './MentionChip';
import type { MentionContact } from './mentionHandle';
import mentionLabel from './mentionLabel';
import mentionParts, { type MentionTextValue } from './mentionParts';

import Text from '@/components/Text';

type MentionTextProps = {
  value: MentionTextValue;
  contactsById: ReadonlyMap<string, MentionContact>;
  /** The channel a copy is for: its chips read as the contacts' handles there. */
  channel?: Pick<Channel, 'handleField'>;
  /** A tap on a live contact's chip; without it (a list row's card is the press target) chips take none. */
  onPressMention?: (contactId: string) => void;
  /** Whether a long press copies the text: only where it has no chip (chips break iOS selection). */
  isSelectable?: boolean;
};

/**
 * A post's text, read-only, each valid mention (mentionParts) a chip in the line (MentionChip,
 * labelled as mentionLabel reads it). A chip of a deleted contact shows its stored name and takes no
 * tap. A text without valid mentions is plain reading text, as before mentions.
 */
export default function MentionText({
  value,
  contactsById,
  channel,
  onPressMention,
  isSelectable = false,
}: MentionTextProps) {
  const parts = mentionParts(value.text, value.mentions);
  const hasChips = parts.some((part) => part.kind === 'mention');

  return (
    <Text selectable={isSelectable && !hasChips}>
      {parts.map((part) => {
        if (part.kind === 'text') return part.text;
        const contact = contactsById.get(part.mention.contactId);
        return (
          <MentionChip
            key={part.mention.location}
            label={mentionLabel(part.mention, contactsById, channel)}
            contact={contact ?? { name: part.mention.name }}
            onPress={contact && onPressMention ? () => onPressMention(contact.id) : undefined}
          />
        );
      })}
    </Text>
  );
}
