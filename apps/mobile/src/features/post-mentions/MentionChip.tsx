import { Platform, Pressable, Text as RNText, StyleSheet, useWindowDimensions } from 'react-native';

import { mentionChipBox } from './mentionChipStyle';

import ContactAvatar, { type ContactAvatarProps } from '@/features/contact-avatar/ContactAvatar';
import { colors, press, textStyles } from '@/styles/designTokens';

type MentionChipProps = {
  label: string;
  /** Whose photo the chip shows, as every avatar does (ContactAvatar): a deleted contact's stored name. */
  contact: ContactAvatarProps['contact'];
  /** Without it the chip takes no tap (a list row's card is the press target, a deleted contact). */
  onPress?: () => void;
};

// The system font's capitals for its size (UIFont.capHeight / pointSize).
const CAP_HEIGHT = 0.7;

// iOS sits an inline view's bottom on the line's own baseline, which is under the text's by half of
// what the line is taller than the font (React Native lifts the text to the line's middle, not the
// view). Down by this, the chip's middle is on the middle of the capitals, as the native field
// draws its chips (chipOffset in MentionInputView.swift). The web lines up the chip's label with
// the text's baseline by itself.
function iosDrop(chipHeight: number, fontSize: number, lineHeight: number) {
  return (chipHeight - fontSize * CAP_HEIGHT) / 2 - (lineHeight - chipHeight) / 2;
}

/**
 * A mention in read-only text (MentionText): the contact's round avatar (ContactAvatar) and the label on a muted
 * pill, the look and measures of the native field's chips (mentionChipStyle), so a text reads the
 * same written and shown. It sits in a line of text.
 */
export default function MentionChip({ label, contact, onPress }: MentionChipProps) {
  // The text around the chip grows with the phone's text size setting, so the chip does too.
  const { fontScale } = useWindowDimensions();

  const fontSize = textStyles.reading.fontSize * fontScale;
  const box = mentionChipBox(fontSize);
  const boxStyle = {
    height: box.height,
    paddingLeft: box.inset,
    paddingRight: box.trailing,
    gap: box.gap,
    borderRadius: box.radius,
    transform:
      Platform.OS === 'ios'
        ? [{ translateY: iosDrop(box.height, fontSize, textStyles.reading.lineHeight * fontScale) }]
        : undefined,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, boxStyle, pressed && press.flat]}
    >
      {/* The chip is read as its label: the avatar says nothing of its own. */}
      <ContactAvatar contact={contact} size={box.avatar} isDecorative />
      <RNText style={styles.label} numberOfLines={1}>
        {label}
      </RNText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.muted,
  },
  // Its size grows with the text size setting by itself, as the text around it.
  label: {
    fontSize: textStyles.reading.fontSize,
    color: colors.text.primary,
  },
});
