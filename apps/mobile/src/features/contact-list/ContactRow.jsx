import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import contactSubtitle from './contactSubtitle';

import Divider from '@/components/Divider';
import SelectIndicator from '@/components/SelectIndicator';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, layout, press, radii, scale } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

const AVATAR_INSET = layout.sideGutter + scale(44) + 12;

/**
 * A contact in a list of contacts: its avatar (with the favorite's heart), name and "place ·
 * @handle", and `trailing` at its end, beside the row's press area (its ⋯ menu). The rows of one list
 * read as one card: `isFirst` and `isLast` round its ends, and a divider inset to the text separates
 * the rest. The row opens the contact unless given `onPress`; with `isSelected` (true or false) it is
 * a row to pick, with a selection circle at its end.
 */
export default function ContactRow({ contact, trailing, onPress, isSelected, isFirst, isLast }) {
  const subtitle = contactSubtitle(contact);

  return (
    <View style={[styles.surface, isFirst && styles.first, isLast && styles.last]}>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.pressable, pressed && press.flat]}
          onPress={onPress ?? (() => router.navigate(`/contact/${contact.id}`))}
          accessibilityRole="button"
          accessibilityState={isSelected === undefined ? undefined : { selected: isSelected }}
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
          {isSelected !== undefined && <SelectIndicator isSelected={isSelected} style={styles.indicator} />}
        </Pressable>
        {trailing}
      </View>
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
    paddingRight: 4,
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: layout.sideGutter,
    paddingVertical: 10,
  },
  labels: {
    flex: 1,
  },
  indicator: {
    marginRight: 8,
  },
  divider: {
    marginLeft: AVATAR_INSET,
  },
});
