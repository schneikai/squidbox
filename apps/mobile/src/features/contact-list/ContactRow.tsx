import { router } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ContactListPills from './ContactListPills';
import contactPlace from './contactPlace';
import type { ContactSummary } from './contactQuery';

import Divider from '@/components/Divider';
import Icon from '@/components/Icon';
import IconSlotContext from '@/components/IconSlotContext';
import SelectIndicator from '@/components/SelectIndicator';
import SuperPressable from '@/components/SuperPressable';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContacts from '@/features/contacts-context/useContacts';
import useHaptics from '@/hooks/useHaptics';
import { colors, layout, press, radii, sizes, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

// Between the avatar and the text; the divider starts where the text does.
const GAP = layout.rowLeadingGap;
const AVATAR_INSET = layout.rowInset + sizes.avatar.row + GAP;
// The row's inset at its end, outside the press area: a trailing 44 pt button's glyph ends rowInset
// from the edge, and so does the text, with the press area's own padding.
const END_INSET = layout.rowInset - (sizes.iconButton - sizes.icon) / 2;

/**
 * A contact in a list of contacts: its avatar (with the favorite's heart), name, place (wrapping
 * onto more lines rather than cut off) and, when the row has them (contactQuery's `withLists`), its
 * lists as pills (ContactListPills), and `trailing` at its end, beside the row's press area (a
 * Restore button); without one, a row that opens the contact ends with Row's chevron. `onLongPress` opens its menu (ContactRowMenu's trigger), with a peek tap. The rows of one list
 * read as one card: `isFirst` and `isLast` round its ends, and a divider inset to the text separates
 * the rest. `subtitle` replaces the place line. The row opens the contact unless given `onPress`; with `isSelected` (true or false) it is
 * a row to pick, with a selection circle at its end.
 */
type ContactRowProps = {
  contact: Pick<ContactSummary, 'id' | 'name' | 'avatarFilename' | 'isFavorite' | 'places' | 'listNames'>;
  subtitle?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  isSelected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
};

function ContactRow({
  contact,
  subtitle: givenSubtitle,
  trailing,
  onPress,
  onLongPress,
  isSelected,
  isFirst,
  isLast,
}: ContactRowProps) {
  const { toggleFavoriteContact } = useContacts();
  const haptics = useHaptics();
  const subtitle = givenSubtitle === undefined ? contactPlace(contact) : givenSubtitle;
  // A picker's row (isSelected given) only picks; a browsing row's avatar favorites on a double tap.
  const canFavorite = isSelected === undefined;

  function handlePress() {
    if (onPress) onPress();
    else router.navigate(`/contact/${contact.id}`);
  }

  const handleLongPress =
    onLongPress &&
    (() => {
      haptics.peek();
      onLongPress();
    });

  function handleToggleFavorite() {
    haptics.selection();
    toggleFavoriteContact(contact.id);
  }

  const avatar = <ContactAvatar contact={contact} size="row" isFavorite={contact.isFavorite} />;

  return (
    <View style={[styles.surface, isFirst && styles.first, isLast && styles.last]}>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.pressable, pressed && press.flat]}
          onPress={handlePress}
          onLongPress={handleLongPress}
          accessibilityRole="button"
          accessibilityState={canFavorite ? undefined : { selected: isSelected }}
        >
          {canFavorite ? (
            <SuperPressable
              onPress={handlePress}
              onDoublePress={handleToggleFavorite}
              onLongPress={handleLongPress}
              accessibilityRole="button"
              accessibilityLabel={contact.name}
              accessibilityHint={contact.isFavorite ? 'Double tap to remove from favorites' : 'Double tap to favorite'}
            >
              {avatar}
            </SuperPressable>
          ) : (
            avatar
          )}
          <View style={styles.labels}>
            <Text style={listTextStyles.name}>{contact.name}</Text>
            {!!subtitle && <Text style={listTextStyles.detail}>{subtitle}</Text>}
            {!!contact.listNames?.length && <ContactListPills names={contact.listNames} />}
          </View>
          {!canFavorite && <SelectIndicator isSelected={isSelected} style={styles.indicator} />}
          {canFavorite && !trailing && (
            <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} />
          )}
        </Pressable>
        {/* A full 44 pt slot, so its icon sits in from the card's edge. */}
        <IconSlotContext.Provider value>{trailing}</IconSlotContext.Provider>
      </View>
      {!isLast && <Divider style={styles.divider} />}
    </View>
  );
}

export default memo(ContactRow);

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
    paddingRight: END_INSET,
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingLeft: layout.rowInset,
    paddingRight: layout.rowInset - END_INSET,
    paddingVertical: layout.rowPaddingYCompact,
  },
  labels: {
    flex: 1,
  },
  indicator: {
    marginRight: space.xs,
  },
  divider: {
    marginLeft: AVATAR_INSET,
  },
});
