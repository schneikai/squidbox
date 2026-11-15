import { CONTACT_HANDLES, type ContactHandleField } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import { Row, Section } from '@/components/settings-list/SettingsList';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { space } from '@/styles/designTokens';

type MentionContact = { id: string; name: string; avatarFilename?: string | null } & Partial<
  Record<ContactHandleField, string | null>
>;

type MentionContactSheetProps = {
  /** The contact of the tapped chip; null hides the sheet. */
  contact: MentionContact | null;
  onClose: () => void;
  onOpenContact: (id: string) => void;
};

/**
 * SPIKE: who a mention's chip is, in a sheet: the contact's avatar, the handle on each platform
 * (what the chip becomes there) and Open contact for the full page.
 */
export default function MentionContactSheet({ contact, onClose, onOpenContact }: MentionContactSheetProps) {
  return (
    <BottomSheet isVisible={contact != null} onClose={onClose} title={contact?.name ?? ''}>
      {contact && (
        <View style={styles.body}>
          <View style={styles.avatar}>
            <ContactAvatar contact={contact} size="hero" />
          </View>
          <Section>
            {CONTACT_HANDLES.map(({ field, label }) => (
              <Row key={field} label={label} value={contact[field] ? `@${contact[field]}` : 'No handle'} />
            ))}
          </Section>
          <Section>
            <Row label="Open contact" hasChevron onPress={() => onOpenContact(contact.id)} />
          </Section>
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
