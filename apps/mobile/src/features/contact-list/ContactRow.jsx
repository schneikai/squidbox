import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ContactRowMenu from './ContactRowMenu';
import contactSubtitle from './contactSubtitle';

import Divider from '@/components/Divider';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, layout, press, radii, scale } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

const AVATAR_INSET = layout.sideGutter + scale(44) + 12;

/**
 * A contact in a list of contacts: its avatar (with the favorite's heart), name and "place ·
 * @handle", and its ⋯ menu (ContactRowMenu; `listId` inside a list). The rows of one list read as
 * one card: `isFirst` and `isLast` round its ends, and a divider inset to the text separates the
 * rest. The row opens the contact.
 */
export default function ContactRow({ contact, listId, isFirst, isLast }) {
  const subtitle = contactSubtitle(contact);

  return (
    <View style={[styles.surface, isFirst && styles.first, isLast && styles.last]}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && press.flat]}
        onPress={() => router.navigate(`/contact/${contact.id}`)}
        accessibilityRole="button"
      >
        <ContactAvatar contact={contact} isFavorite={contact.isFavorite} />
        <View style={styles.labels}>
          <Text style={listTextStyles.title} numberOfLines={1}>
            {contact.name}
          </Text>
          {!!subtitle && (
            <Text style={listTextStyles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <ContactRowMenu contact={contact} listId={listId} />
      </Pressable>
      {!isLast && <Divider style={styles.divider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.background.surface,
    overflow: 'hidden',
  },
  first: {
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
  },
  last: {
    borderBottomLeftRadius: radii.card,
    borderBottomRightRadius: radii.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: layout.sideGutter,
    paddingRight: 4,
    paddingVertical: 10,
  },
  labels: {
    flex: 1,
  },
  divider: {
    marginLeft: AVATAR_INSET,
  },
});
