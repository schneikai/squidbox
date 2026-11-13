import { router } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ContactListPills from './ContactListPills';
import contactPlaces from './contactPlaces';

import Divider from '@/components/Divider';
import RowSlots from '@/components/RowSlots';
import SelectIndicator from '@/components/SelectIndicator';
import SuperPressable from '@/components/SuperPressable';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useHaptics from '@/hooks/useHaptics';
import longPressAccessibility from '@/lib/longPressAccessibility';
import useContacts from '@/providers/contacts/useContacts';
import { colors, layout, press, radii, sizes } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import type { ContactSummary } from '@/sync/queries/contactQuery';

// Between the avatar and the text; the divider starts where the text does.
const AVATAR_INSET = layout.rowInset + sizes.avatar.row + layout.rowLeadingGap;

/**
 * A contact in a list of contacts: its avatar (with the favorite's heart), name, places (wrapping
 * onto more lines rather than cut off) and, when the row has them (contactQuery's `withLists`), its
 * lists as pills (ContactListPills), and `trailing` at its end, beside the row's press area (a
 * Restore button); without one, a row that opens the contact ends with Row's chevron. `onLongPress` opens its menu (ContactRowMenu's `openFromLongPress`). The rows of one list
 * read as one card: `isFirst` and `isLast` round its ends, and a divider inset to the text separates
 * the rest. The row opens the contact unless given `onPress`; with `isSelected` (true or false) it is
 * a row to pick, with a selection circle at its end (`'mixed'`: a dash, picked for some of several).
 */
type ContactRowProps = {
  contact: Pick<ContactSummary, 'id' | 'name' | 'avatarFilename' | 'isFavorite' | 'places' | 'listNames'>;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  isSelected?: boolean | 'mixed';
  isFirst?: boolean;
  isLast?: boolean;
};

function ContactRow({ contact, trailing, onPress, onLongPress, isSelected, isFirst, isLast }: ContactRowProps) {
  const { toggleFavoriteContact } = useContacts();
  const haptics = useHaptics();
  const subtitle = contactPlaces(contact);
  // A picker's row (isSelected given) only picks; a browsing row's avatar favorites on a double tap.
  const canFavorite = isSelected === undefined;

  function handlePress() {
    if (onPress) onPress();
    else router.navigate(`/contact/${contact.id}`);
  }

  function handleToggleFavorite() {
    haptics.selection();
    toggleFavoriteContact(contact.id);
  }

  const avatar = <ContactAvatar contact={contact} size="row" isFavorite={contact.isFavorite} />;

  return (
    <View style={[styles.surface, isFirst && styles.first, isLast && styles.last]}>
      <Pressable
        style={({ pressed }) => pressed && press.flat}
        onPress={handlePress}
        onLongPress={onLongPress}
        {...longPressAccessibility(onLongPress)}
        accessibilityRole="button"
        accessibilityState={
          canFavorite ? undefined : isSelected === 'mixed' ? { checked: 'mixed' } : { selected: isSelected }
        }
      >
        <RowSlots
          leading={
            canFavorite ? (
              <SuperPressable
                onPress={handlePress}
                onDoublePress={handleToggleFavorite}
                onLongPress={onLongPress}
                // No button role: it sits inside the row's button, and the web can't nest buttons.
                accessibilityLabel={contact.name}
                accessibilityHint={
                  contact.isFavorite ? 'Double tap to remove from favorites' : 'Double tap to favorite'
                }
              >
                {avatar}
              </SuperPressable>
            ) : (
              avatar
            )
          }
          trailing={canFavorite ? trailing : <SelectIndicator isSelected={isSelected} />}
          hasChevron={canFavorite}
          size="small"
        >
          <Text style={listTextStyles.name}>{contact.name}</Text>
          {!!subtitle && <Text style={listTextStyles.detail}>{subtitle}</Text>}
          {!!contact.listNames?.length && <ContactListPills names={contact.listNames} />}
        </RowSlots>
      </Pressable>
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
  divider: {
    marginLeft: AVATAR_INSET,
  },
});
