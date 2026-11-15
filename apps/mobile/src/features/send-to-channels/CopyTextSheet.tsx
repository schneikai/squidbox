import type { Channel } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

import Badge from '@/components/Badge';
import BottomSheet from '@/components/BottomSheet';
import Text from '@/components/Text';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import ChannelLogo from '@/features/channels/ChannelLogo';
import { space } from '@/styles/designTokens';

/** A channel Copy text can copy for: the text it gets there, its mentions as written there, and whether one has no handle there. */
export type ChannelChoice = { channel: Channel; text: string; mentions: string; hasNoHandle: boolean };

type CopyTextSheetProps = {
  choices: ChannelChoice[];
  onPick: (choice: ChannelChoice) => void;
  onClose: () => void;
};

/**
 * Copy text's one question, in a sheet: "Copy text for" each channel, its logo and the post's
 * mentions as they are copied for it (a contact without a handle there by name, under a badge that says so); a tap copies that channel's text.
 */
export default function CopyTextSheet({ choices, onPick, onClose }: CopyTextSheetProps) {
  return (
    <BottomSheet isVisible onClose={onClose} title="Copy text for">
      <Section isFlat>
        {choices.map((choice) => (
          <Row
            key={choice.channel.id}
            leading={<ChannelLogo channelId={choice.channel.id} />}
            label={choice.channel.name}
            onPress={() => onPick(choice)}
          >
            <View style={styles.copied}>
              {choice.hasNoHandle && <Badge label="No handle" tone="warning" />}
              <Text variant="status">{choice.mentions}</Text>
            </View>
          </Row>
        ))}
      </Section>
      <SectionFooter>Without a handle there, the contact&apos;s name is used.</SectionFooter>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // The badge that says why a name is copied, and under it what is copied.
  copied: {
    flexShrink: 1,
    alignItems: 'flex-end',
    gap: space.xs,
  },
});
