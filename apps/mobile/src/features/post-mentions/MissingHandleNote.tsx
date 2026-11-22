import { CONTACT_HANDLE_BY_FIELD, type Channel } from '@squidbox/shared';

import AddHandleButton from './AddHandleButton';
import type { MentionContact } from './mentionHandle';

import WarningNote, { type WarningNoteProps } from '@/components/WarningNote';
import joinWords from '@/utils/joinWords';

type MissingHandleNoteProps = {
  /** The mentioned contacts without a handle on `channel` (textForChannel's `missing`). */
  contacts: readonly MentionContact[];
  channel: Pick<Channel, 'name' | 'handleField'>;
  style?: WarningNoteProps['style'];
};

/**
 * The warning on a channel copy (its card, its composer) that mentions contacts without a handle on
 * the channel (their chips show the name): their names go out as plain text. It names the handle the
 * channel uses (handleField), so OnlyFans PPV says OnlyFans. Add handle under it (AddHandleButton) stores one.
 * Nothing without such a contact. style is for layout only.
 */
export default function MissingHandleNote({ contacts, channel, style }: MissingHandleNoteProps) {
  if (contacts.length === 0) return null;

  return (
    <WarningNote style={style} action={<AddHandleButton contacts={contacts} channel={channel} />}>
      {`${joinWords(contacts.map(({ name }) => name))} ${contacts.length === 1 ? 'has' : 'have'} no ${CONTACT_HANDLE_BY_FIELD[channel.handleField].label} handle.`}
    </WarningNote>
  );
}
