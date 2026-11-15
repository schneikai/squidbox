import type { Channel } from '@squidbox/shared';

import MentionRuns from './MentionRuns';
import type { MentionContact } from './mentionHandle';
import type { MentionTextValue } from './mentionParts';

import Text from '@/components/Text';

type MentionTextProps = {
  value: MentionTextValue;
  contactsById: ReadonlyMap<string, MentionContact>;
  /** The channel a copy is for: its chips read as the contacts' handles there. */
  channel?: Pick<Channel, 'handleField'>;
  /** A tap on a live contact's chip; without it (a list row's card is the press target) chips take none. */
  onPressMention?: (contactId: string) => void;
};

/**
 * A post's text, read-only, each valid mention a chip in the line (MentionRuns). A chip of a deleted
 * contact shows its stored name and takes no tap. A text without valid mentions is plain reading
 * text, as before mentions.
 */
export default function MentionText({ value, contactsById, channel, onPressMention }: MentionTextProps) {
  return (
    <Text hasInlineViews>
      <MentionRuns value={value} contactsById={contactsById} channel={channel} onPressMention={onPressMention} />
    </Text>
  );
}
