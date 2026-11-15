import { Platform, Pressable, Text as RNText, StyleSheet } from 'react-native';

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

const BOX = mentionChipBox(textStyles.reading.fontSize);
// The system font's capitals for its size (UIFont.capHeight / pointSize).
const CAP_HEIGHT = 0.7;
// iOS sits an inline view on the baseline: down by this, its middle is on the middle of the
// capitals, as the native field draws its chips (chipOffset in MentionInputView.swift). The web lines
// up the chip's label with the text's baseline by itself.
const IOS_DROP = (BOX.height - textStyles.reading.fontSize * CAP_HEIGHT) / 2;

/**
 * A mention in read-only text (MentionText): the contact's round avatar (ContactAvatar) and the label on a muted
 * pill, the look and measures of the native field's chips (mentionChipStyle), so a text reads the
 * same written and shown. It sits in a line of text.
 */
export default function MentionChip({ label, contact, onPress }: MentionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, pressed && press.flat]}
    >
      {/* The chip is read as its label: the avatar says nothing of its own. */}
      <ContactAvatar contact={contact} size={BOX.avatar} isDecorative />
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
    height: BOX.height,
    paddingLeft: BOX.inset,
    paddingRight: BOX.trailing,
    gap: BOX.gap,
    borderRadius: BOX.radius,
    backgroundColor: colors.background.muted,
    transform: Platform.OS === 'ios' ? [{ translateY: IOS_DROP }] : undefined,
  },
  label: {
    fontSize: BOX.labelSize,
    color: colors.text.primary,
  },
});
