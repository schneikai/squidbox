import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import contactSubtitle from './contactSubtitle';

import Divider from '@/components/Divider';
import IconSlotContext from '@/components/IconSlotContext';
import SelectIndicator from '@/components/SelectIndicator';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, layout, press, radii, sizes } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

// Between the avatar and the text; the divider starts where the text does.
const GAP = 14;
const AVATAR_INSET = layout.sideGutter + sizes.avatar.row + GAP;

/**
 * A contact in a list of contacts: its avatar (with the favorite's heart), name and "place ·
 * @handle" (wrapping onto more lines rather than cut off), and `trailing` at its end, beside the row's press area (its ⋯ menu). The rows of one list
 * read as one card: `isFirst` and `isLast` round its ends, and a divider inset to the text separates
 * the rest. `subtitle` replaces the "place · @handle" line (a picker shows only the place). The row opens the contact unless given `onPress`; with `isSelected` (true or false) it is
 * a row to pick, with a selection circle at its end.
 */
export default function ContactRow({
  contact,
  subtitle: givenSubtitle,
  trailing,
  onPress,
  isSelected,
  isFirst,
  isLast,
}) {
  const subtitle = givenSubtitle === undefined ? contactSubtitle(contact) : givenSubtitle;

  return (
    <View style={[styles.surface, isFirst && styles.first, isLast && styles.last]}>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.pressable, pressed && press.flat]}
          onPress={onPress ?? (() => router.navigate(`/contact/${contact.id}`))}
          accessibilityRole="button"
          accessibilityState={isSelected === undefined ? undefined : { selected: isSelected }}
        >
          <ContactAvatar contact={contact} size="row" isFavorite={contact.isFavorite} />
          <View style={styles.labels}>
            <Text style={listTextStyles.name}>{contact.name}</Text>
            {!!subtitle && <Text style={listTextStyles.detail}>{subtitle}</Text>}
          </View>
          {isSelected !== undefined && <SelectIndicator isSelected={isSelected} style={styles.indicator} />}
        </Pressable>
        {/* A full 44 pt slot, so its icon sits in from the card's edge. */}
        <IconSlotContext.Provider value>{trailing}</IconSlotContext.Provider>
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
    paddingRight: 6,
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingLeft: layout.sideGutter,
    paddingRight: 10,
    paddingVertical: 12,
  },
  labels: {
    flex: 1,
  },
  indicator: {
    marginRight: 6,
  },
  divider: {
    marginLeft: AVATAR_INSET,
  },
});
