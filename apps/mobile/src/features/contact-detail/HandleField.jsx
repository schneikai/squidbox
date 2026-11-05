import { CONTACT_HANDLES, CONTACT_LIMITS } from '@squidbox/shared';
import { StyleSheet, Text, View } from 'react-native';

import openContactLinkAsync from './openContactLinkAsync';

import Button from '@/components/Button';
import Icon from '@/components/Icon';
import TextInput from '@/components/TextInput';
import { colors, layout, scale, sizes, typography } from '@/styles/designTokens';

// Wide enough for "OnlyFans"; a larger text size widens it instead of clipping.
const LABEL_WIDTH = scale(84);
const DOT = scale(8);
const OPEN_LABELS = {
  ...Object.fromEntries(CONTACT_HANDLES.map(({ field, label }) => [field, `Open on ${label}`])),
  phoneNumber: 'Message on WhatsApp',
};
// The longest text each field takes (the synced schema's limits; a handle as typed or pasted).
const MAX_LENGTHS = { name: CONTACT_LIMITS.name, phoneNumber: CONTACT_LIMITS.phoneNumber };

/**
 * One of a contact's handles (or its phone number) as a row of a card: the label on the left, the
 * text on the right, and while it holds one a 44 pt button that opens it where it lives
 * (openContactLinkAsync). `field` is the contact field it edits (xHandle, …, phoneNumber, or the
 * name in the New contact sheet): a handle takes no capitals or corrections, the phone number the
 * phone pad. `isFilled` marks a value the
 * assistant filled in (a sparkle), `isDuplicate` one another contact has too (an amber dot).
 */
export default function HandleField({
  field,
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  isFilled = false,
  isDuplicate = false,
  isOpenable = true,
}) {
  const isPhone = field === 'phoneNumber';
  const isName = field === 'name';

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        style={styles.input}
        accessibilityLabel={label}
        maxLength={MAX_LENGTHS[field] ?? CONTACT_LIMITS.handle}
        autoCapitalize={isName ? 'words' : 'none'}
        autoCorrect={false}
        keyboardType={isPhone ? 'phone-pad' : 'default'}
        textContentType={isPhone ? 'telephoneNumber' : isName ? 'name' : 'none'}
      />
      {isDuplicate && <View style={styles.dot} accessibilityLabel="Another contact has this too" />}
      {isFilled && <Icon name="sparkle" size={sizes.iconSmall} color={colors.accent.base} />}
      {isOpenable && !!value.trim() && (
        <Button
          icon={isPhone ? 'message-circle' : 'external-link'}
          colorPalette="accent"
          onPress={() => openContactLinkAsync(field, value)}
          accessibilityLabel={OPEN_LABELS[field]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: scale(52),
    paddingLeft: layout.sideGutter,
    paddingRight: 4,
  },
  label: {
    minWidth: LABEL_WIDTH,
    fontSize: typography.body,
    color: colors.text.primary,
  },
  input: {
    flex: 1,
    minWidth: 0, // a web input is as wide as its text box otherwise, which pushes the button out
    paddingVertical: 14,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.status.warning,
  },
});
