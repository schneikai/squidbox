import { useContext } from 'react';
import { Platform, Pressable, Text as RNText, StyleSheet, useWindowDimensions } from 'react-native';

import { mentionChipBox } from './mentionChipStyle';

import InkContext from '@/components/InkContext';
import TextMetricsContext from '@/components/TextMetricsContext';
import ContactAvatar, { type ContactAvatarProps } from '@/features/contact-avatar/ContactAvatar';
import { FONT_LINE, press } from '@/styles/designTokens';

type MentionChipProps = {
  label: string;
  /** Whose photo the chip shows, as every avatar does (ContactAvatar): a deleted contact's stored name. */
  contact: ContactAvatarProps['contact'];
  /** Without it the chip takes no tap (a list row's card is the press target, a deleted contact). */
  onPress?: () => void;
};

// The system font's capitals for its size (UIFont.capHeight / pointSize).
const CAP_HEIGHT = 0.7;
// What is left after the two terms below, measured on a phone (the chip sat this much low), per point of text size.
const IOS_LIFT = 0.08;

// iOS sits an inline view's bottom on the line's own baseline, which is under the text's by half of
// what the line is taller than the font (React Native lifts the text to the line's middle, not the
// view). Down by this, the chip's middle is on the middle of the capitals, as the native field
// draws its chips (chipOffset in MentionInputView.swift). The web lines an inline chip up by its
// first item's baseline (the avatar's initials), so there the label is that item (`baseline`),
// centred by its top margin.
function iosDrop(chipHeight: number, fontSize: number, lineHeight: number) {
  return (chipHeight - fontSize * CAP_HEIGHT) / 2 - (lineHeight - chipHeight) / 2 - fontSize * IOS_LIFT;
}

/**
 * A mention in read-only text (MentionText, MentionRuns): the contact's round avatar (ContactAvatar)
 * and the label on a tag chip's fill (the ink's, like Chip), the look and measures of the native field's chips
 * (mentionChipStyle), so a text reads the same written and shown. It sits in a line of text, sized by
 * it (TextMetricsContext).
 */
export default function MentionChip({ label, contact, onPress }: MentionChipProps) {
  // The text around the chip grows with the phone's text size setting, so the chip does too.
  const { fontScale } = useWindowDimensions();
  const textMetrics = useContext(TextMetricsContext);
  const ink = useContext(InkContext);

  const fontSize = textMetrics.fontSize * fontScale;
  const box = mentionChipBox(fontSize);
  const boxStyle = {
    height: box.height,
    paddingLeft: box.inset,
    paddingRight: box.trailing,
    gap: box.gap,
    borderRadius: box.radius,
    transform:
      Platform.OS === 'ios'
        ? [{ translateY: iosDrop(box.height, fontSize, textMetrics.lineHeight * fontScale) }]
        : undefined,
  };

  // Its size (the text's) grows with the text size setting by itself, as the text around it.
  const labelStyle = { color: ink.primary, fontSize: textMetrics.fontSize };
  const webLabelStyle = Platform.OS === 'web' && { marginTop: (box.height - box.labelSize * FONT_LINE) / 2 };

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, boxStyle, { backgroundColor: ink.fill }, pressed && press.flat]}
    >
      {/* The chip is read as its label: the avatar says nothing of its own. */}
      <ContactAvatar contact={contact} size={box.avatar} isDecorative />
      <RNText style={[labelStyle, webLabelStyle && [styles.webLabel, webLabelStyle]]} numberOfLines={1}>
        {label}
      </RNText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webLabel: {
    alignSelf: 'baseline',
  },
});
