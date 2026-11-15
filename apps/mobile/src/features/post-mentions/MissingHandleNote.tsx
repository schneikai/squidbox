import type { Channel } from '@squidbox/shared';

import type { MentionContact } from './mentionHandle';

import WarningNote, { type WarningNoteProps } from '@/components/WarningNote';
import joinWords from '@/utils/joinWords';

type MissingHandleNoteProps = {
  /** The mentioned contacts without a handle on `channel` (textForChannel's `missing`). */
  contacts: readonly MentionContact[];
  channel: Pick<Channel, 'name'>;
  style?: WarningNoteProps['style'];
};

/**
 * The warning on a channel copy (its card, its composer) that mentions contacts without a handle on
 * the channel: their names go out as plain text. Nothing without such a contact. style is for layout
 * only.
 */
export default function MissingHandleNote({ contacts, channel, style }: MissingHandleNoteProps) {
  if (contacts.length === 0) return null;

  const names = joinWords(contacts.map((contact) => contact.name));

  return (
    <WarningNote style={style}>
      {contacts.length === 1
        ? `${names} has no ${channel.name} handle. Using the name instead.`
        : `${names} have no ${channel.name} handle. Using their names instead.`}
    </WarningNote>
  );
}
