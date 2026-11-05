import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, press, scale, typography } from '@/styles/designTokens';

/** The favorites row: each favorite's avatar with its first name, side by side, opening the contact. */
export default function ContactAvatarRow({ contacts }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {contacts.map((contact) => (
        <Pressable
          key={contact.id}
          style={({ pressed }) => [styles.item, pressed && press.flat]}
          onPress={() => router.navigate(`/contact/${contact.id}`)}
          accessibilityRole="button"
          accessibilityLabel={contact.name}
        >
          <ContactAvatar contact={contact} size="large" isFavorite />
          <Text style={styles.name} numberOfLines={1}>
            {contact.name.trim().split(/\s+/)[0]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 14,
  },
  item: {
    width: scale(64),
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: typography.caption,
    fontWeight: '500',
    color: colors.text.primary,
  },
});
