import { Pressable, StyleSheet, Text } from 'react-native';

import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, press, radii, scale, typography } from '@/styles/designTokens';

const HEIGHT = scale(40);

/** A contact as a chip: its small avatar and name on a grey pill, opening it with `onPress`. */
export default function ContactChip({ contact, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={contact.name}
      style={({ pressed }) => [styles.chip, pressed && press.flat]}
    >
      <ContactAvatar contact={contact} size="small" />
      <Text style={styles.name} numberOfLines={1}>
        {contact.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.background.muted,
  },
  name: {
    fontSize: typography.subheadline,
    color: colors.text.primary,
  },
});
