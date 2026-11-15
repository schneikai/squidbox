import type { Channel } from '@squidbox/shared';

import BottomSheet from '@/components/BottomSheet';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import ChannelLogo from '@/features/channels/ChannelLogo';

/** A channel Copy text can copy for: the text it gets there, and its mentions as written there. */
export type ChannelChoice = { channel: Channel; text: string; mentions: string };

type CopyTextSheetProps = {
  choices: ChannelChoice[];
  onPick: (choice: ChannelChoice) => void;
  onClose: () => void;
};

/**
 * Copy text's one question, in a sheet: "Copy text for" each channel, its logo and the post's
 * mentions as they are copied for it (a contact without a handle there by name, said so); a tap copies that channel's text.
 */
export default function CopyTextSheet({ choices, onPick, onClose }: CopyTextSheetProps) {
  return (
    <BottomSheet isVisible onClose={onClose} title="Copy text for">
      <Section>
        {choices.map((choice) => (
          <Row
            key={choice.channel.id}
            leading={<ChannelLogo channelId={choice.channel.id} />}
            label={choice.channel.name}
            value={choice.mentions}
            onPress={() => onPick(choice)}
          />
        ))}
      </Section>
      <SectionFooter>A contact without a handle there is copied by name.</SectionFooter>
    </BottomSheet>
  );
}
