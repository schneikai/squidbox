import { type StyleProp, StyleSheet, Text, type TextStyle } from 'react-native';

import { colors, layout, radii, textStyles } from '@/styles/designTokens';

const TONES = {
  danger: { backgroundColor: colors.status.dangerLight, color: colors.status.danger },
  accent: { backgroundColor: colors.accent.light, color: colors.accent.base },
  success: { backgroundColor: colors.status.successLight, color: colors.status.success },
  info: { backgroundColor: colors.status.infoLight, color: colors.status.info },
  warning: { backgroundColor: colors.status.warningLight, color: colors.status.warningInk },
  neutral: { backgroundColor: colors.background.fill, color: colors.text.secondary },
};

export type BadgeProps = {
  label: string;
  tone: keyof typeof TONES;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
};

// A small uppercase label on a list entry or a screen ("Archived", "Uncensored", "Verified", the
// lists a contact is in), in a `tone`: danger | accent | success | info | warning (yellow) | neutral
// (grey, a tag chip's fill). Every fill is see-through, so a badge sits on any surface. `numberOfLines` cuts a long one short (a name someone typed). The parent positions it through `style`.
export default function Badge({ label, tone, numberOfLines, style }: BadgeProps) {
  return (
    <Text style={[styles.badge, TONES[tone], style]} numberOfLines={numberOfLines}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    overflow: 'hidden',
    borderRadius: radii.badge,
    paddingHorizontal: layout.capsulePaddingX,
    paddingVertical: layout.capsulePaddingY,
    ...textStyles.caption2Bold,
    textTransform: 'uppercase',
  },
});
