import { Image, Platform, Pressable, Text as RNText, StyleSheet, View } from 'react-native';

import { mentionChipBox, mentionChipStyle } from './mentionChipStyle';

import { colors, press, textStyles } from '@/styles/designTokens';

type MentionChipProps = {
  label: string;
  /** The contact's photo on this device; a grey disc without one. */
  avatarUri: string | null;
  /** Without it the chip takes no tap (a list row's card is the press target, a deleted contact). */
  onPress?: () => void;
};

const BOX = mentionChipBox(textStyles.reading.fontSize);
// The system font's capitals for its size (UIFont.capHeight / pointSize).
const CAP_HEIGHT = 0.7;
// iOS sits an inline view on the baseline: down by this, its middle is on the middle of the
// capitals, as the native field draws its chips (chipOffset in MentionInputView.swift). The web lines
// up the chip's label with the text's baseline by itself.
const IOS_DROP = (BOX.height - textStyles.reading.fontSize * CAP_HEIGHT) / 2 - mentionChipStyle.offsetY;

/**
 * A mention in read-only text (MentionText): the contact's round avatar and the label on a muted
 * pill, the look and measures of the native field's chips (mentionChipStyle), so a text reads the
 * same written and shown. It sits in a line of text.
 */
export default function MentionChip({ label, avatarUri, onPress }: MentionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, pressed && press.flat]}
    >
      {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} /> : <View style={styles.avatar} />}
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
  avatar: {
    width: BOX.avatar,
    height: BOX.avatar,
    borderRadius: BOX.avatar / 2,
    backgroundColor: colors.background.placeholder,
  },
  label: {
    fontSize: BOX.labelSize,
    color: colors.text.primary,
  },
});
