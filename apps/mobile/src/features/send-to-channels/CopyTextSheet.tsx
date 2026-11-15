import type { Channel } from '@squidbox/shared';

import Badge from '@/components/Badge';
import BottomSheet from '@/components/BottomSheet';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import ChannelLogo from '@/features/channels/ChannelLogo';

/** A channel Copy text can copy for: the text it gets there, its mentions as written there, and whether one has no handle there. */
export type ChannelChoice = { channel: Channel; text: string; mentions: string; hasNoHandle: boolean };

type CopyTextSheetProps = {
  choices: ChannelChoice[];
  onPick: (choice: ChannelChoice) => void;
  onClose: () => void;
};

/**
 * Copy text's one question, in a sheet: "Copy text for" each channel, its logo and the post's
 * mentions as they are copied for it (a contact without a handle there by name, with a No handle badge); a tap copies that channel's text.
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
          >
            {choice.hasNoHandle && <Badge label="No handle" tone="warning" />}
          </Row>
        ))}
      </Section>
      <SectionFooter>A contact without a handle there is copied by name.</SectionFooter>
    </BottomSheet>
  );
}
