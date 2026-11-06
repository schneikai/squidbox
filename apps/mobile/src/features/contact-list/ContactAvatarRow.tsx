import type { ContactRecord } from '@squidbox/shared';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, layout, press, sizes, space, textStyles } from '@/styles/designTokens';

/** The pinned row on Contacts (Favorites, or the list pinned in their place): each contact's avatar (no heart) with its first name, side by side, opening the contact. */
type ContactAvatarRowProps = { contacts: Pick<ContactRecord, 'id' | 'name' | 'avatarFilename'>[] };

export default function ContactAvatarRow({ contacts }: ContactAvatarRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
    >
      {contacts.map((contact) => (
        <Pressable
          key={contact.id}
          style={({ pressed }) => [styles.item, pressed && press.flat]}
          onPress={() => router.navigate(`/contact/${contact.id}`)}
          accessibilityRole="button"
          accessibilityLabel={contact.name}
        >
          <ContactAvatar contact={contact} size="medium" />
          <Text style={[textStyles.footnote, styles.name]} numberOfLines={1}>
            {contact.name.trim().split(/\s+/)[0]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Reaches the screen's edges, so it scrolls edge to edge, with the first avatar under the
  // row's label (a section header's inset in from the gutter).
  scroller: {
    marginHorizontal: -layout.sideGutter,
  },
  row: {
    gap: space.xl,
    paddingHorizontal: layout.sideGutter + layout.rowInset,
  },
  item: {
    width: sizes.avatar.medium + 4,
    alignItems: 'center',
    gap: space.sm,
  },
  name: {
    color: colors.text.primary,
  },
});
