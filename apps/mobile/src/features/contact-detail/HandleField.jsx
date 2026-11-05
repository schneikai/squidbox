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
  xHandle: 'Open on X',
  blueskyHandle: 'Open on Bluesky',
  onlyFansHandle: 'Open on OnlyFans',
  jffHandle: 'Open on JFF',
  phoneNumber: 'Message on WhatsApp',
};

/**
 * One of a contact's handles (or its phone number) as a row of a card: the label on the left, the
 * text on the right, and while it holds one a 44 pt button that opens it where it lives
 * (openContactLinkAsync). `field` is the contact field it edits (xHandle, …, phoneNumber): a handle
 * takes no capitals or corrections, the phone number the phone pad. `isFilled` marks a value the
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
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={isPhone ? 'phone-pad' : 'default'}
        textContentType={isPhone ? 'telephoneNumber' : 'none'}
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
    paddingVertical: 14,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.status.warning,
  },
});
