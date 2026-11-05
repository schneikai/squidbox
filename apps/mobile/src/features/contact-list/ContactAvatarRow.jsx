import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, layout, press, sizes, typography } from '@/styles/designTokens';

/** The favorites row: each favorite's avatar (no heart: they are all favorites here) with its first name, side by side, opening the contact. */
export default function ContactAvatarRow({ contacts }) {
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
          <Text style={styles.name} numberOfLines={1}>
            {contact.name.trim().split(/\s+/)[0]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Reaches the screen's edges, so it scrolls edge to edge, with the first avatar at the gutter
  // under the Favorites label.
  scroller: {
    marginHorizontal: -layout.sideGutter,
  },
  row: {
    gap: 18,
    paddingHorizontal: layout.sideGutter,
  },
  item: {
    width: sizes.avatar.medium + 4,
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: typography.caption,
    fontWeight: '500',
    color: colors.text.primary,
  },
});
