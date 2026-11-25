import { StyleSheet, View } from 'react-native';

import mentionChannels from './mentionChannels';
import mentionHandle, { type MentionContact } from './mentionHandle';

import BottomSheet from '@/components/BottomSheet';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useChannels from '@/features/channels/useChannels';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { space } from '@/styles/designTokens';

type MentionContactSheetProps = {
  /** The contact of the tapped chip; null hides the sheet. */
  contact: MentionContact | null;
  onClose: () => void;
  /** Opens the contact's page; left out inside a sheet, where no page is pushed over it. */
  onOpenContact?: (id: string) => void;
};

/**
 * Who a mention's chip is, in a sheet: the contact's avatar, its handle on each of the user's
 * channels (mentionChannels: what the chip goes out as there, mentionHandle; "No handle" without one) and, with `onOpenContact`, Open
 * contact for the full page.
 */
export default function MentionContactSheet({ contact, onClose, onOpenContact }: MentionContactSheetProps) {
  const channels = useChannels();

  return (
    <BottomSheet isVisible={contact != null} onClose={onClose} title={contact?.name ?? ''}>
      {contact && (
        <View style={styles.body}>
          <View style={styles.avatar}>
            <ContactAvatar contact={contact} size="hero" />
          </View>
          {channels && (
            <Section>
              {mentionChannels(channels).map((channel) => {
                const handle = mentionHandle(contact, channel.handleField);
                return <Row key={channel.id} label={channel.name} value={handle ? `@${handle}` : 'No handle'} />;
              })}
            </Section>
          )}
          {onOpenContact && (
            <Section>
              <Row label="Open contact" hasChevron onPress={() => onOpenContact(contact.id)} />
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
