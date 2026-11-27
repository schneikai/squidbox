import { Pressable, StyleSheet, View } from 'react-native';

import mentionChannels from './mentionChannels';
import mentionHandle, { type MentionContact } from './mentionHandle';
import useAskHandle from './useAskHandle';

import BottomSheet from '@/components/BottomSheet';
import Button from '@/components/Button';
import { Row, Section } from '@/components/settings-list/SettingsList';
import ChannelLogo from '@/features/channels/ChannelLogo';
import useChannels from '@/features/channels/useChannels';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { press, space } from '@/styles/designTokens';

type MentionContactSheetProps = {
  /** The contact of the tapped chip; null hides the sheet. */
  contact: MentionContact | null;
  onClose: () => void;
  /** Opens the contact's page; left out inside a sheet, where no page is pushed over it. */
  onOpenContact?: (id: string) => void;
};

/**
 * Who a mention's chip is, in a sheet: the contact's avatar, its handle on each of the user's
 * channels (mentionChannels: what the chip goes out as there, mentionHandle; each beside its logo; Add handle
 * without one, useAskHandle). With `onOpenContact`, a tap on the avatar opens the
 * contact's page.
 */
export default function MentionContactSheet({ contact, onClose, onOpenContact }: MentionContactSheetProps) {
  const channels = useChannels();
  const askHandle = useAskHandle();

  return (
    <BottomSheet isVisible={contact != null} onClose={onClose} title={contact?.name ?? ''}>
      {contact && (
        <View style={styles.body}>
          <View style={styles.avatar}>
            {onOpenContact ? (
              <Pressable
                onPress={() => onOpenContact(contact.id)}
                accessibilityRole="button"
                accessibilityLabel="Open contact"
                style={({ pressed }) => pressed && press.flat}
              >
                <ContactAvatar contact={contact} size="hero" />
              </Pressable>
            ) : (
              <ContactAvatar contact={contact} size="hero" />
            )}
          </View>
          {channels && (
            <Section>
              {mentionChannels(channels).map((channel) => {
                const handle = mentionHandle(contact, channel.handleField);
                const logo = <ChannelLogo channelId={channel.id} />;
                if (handle) return <Row key={channel.id} leading={logo} label={channel.name} value={`@${handle}`} />;
                return (
                  <Row key={channel.id} leading={logo} label={channel.name}>
                    <Button
                      variant="secondary"
                      size="small"
                      label="Add handle"
                      accessibilityLabel={`Add ${channel.name} handle`}
                      onPress={() => askHandle(contact, channel)}
                    />
                  </Row>
                );
              })}
            </Section>
          )}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.md,
  },
  avatar: {
    alignItems: 'center',
  },
});
