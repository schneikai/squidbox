import type { ReactNode } from 'react';
import {
  Text as RNText,
  StyleSheet,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { colors, textStyles } from '@/styles/designTokens';

export type TextVariant = keyof typeof styles;
export type TextTone = keyof typeof toneStyles;

export type TextProps = Pick<RNTextProps, 'selectable' | 'numberOfLines' | 'accessibilityLabel'> & {
  variant?: TextVariant;
  size?: 'regular' | 'small';
  tone?: TextTone;
  children?: ReactNode;
  style?: StyleProp<TextStyle>;
};

/**
 * Text in one of the app's roles. `variant` is what the text is:
 *   reading   — long text someone reads: a post, a model's answer (the default). `size="small"`
 *               for a card's line (a summary, what a chat is about)
 *   hint      — small grey text that explains: a screen's intro, a field's description, a
 *               section's footer
 *   label     — the small bold grey name over a field or a group. `size="small"` for a smaller
 *               one (a video's length on a grid cell)
 *   title     — a card's or a row's bold title. `size="small"` for a smaller one (a pick row's
 *               count)
 *   heading   — a status screen's large bold title (StatusTitle)
 *   status    — a grey line about what's going on: the assistant thinking, a screen's subtitle
 *   error     — what went wrong, in red. `size="small"` for a line under another
 *   assistant — the assistant's violet semibold line, footnote size: an AssistantTray's title
 * `tone` gives the role another of the text colors: primary (a hint or label in the text's color),
 * secondary, inverse (on the accent, danger or a picture), accent, danger, shine (the band sweeping
 * across the assistant's title at work).
 * `selectable` lets it be copied, `numberOfLines` cuts a long one short. style is for layout only.
 * A nested Text takes its own role and tone inside the line (a bold `label` part of a `hint`).
 */
export default function Text({
  variant = 'reading',
  size = 'regular',
  tone,
  children,
  selectable,
  numberOfLines,
  accessibilityLabel,
  style,
}: TextProps) {
  return (
    <RNText
      style={[styles[variant], size === 'small' && smallStyles[variant], tone && toneStyles[tone], style]}
      selectable={selectable}
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  reading: {
    ...textStyles.reading,
    color: colors.text.primary,
  },
  hint: {
    ...textStyles.footnote,
    color: colors.text.secondary,
  },
  label: {
    ...textStyles.footnoteBold,
    color: colors.text.secondary,
  },
  title: {
    ...textStyles.bodyBold,
    color: colors.text.primary,
  },
  heading: {
    ...textStyles.title2,
    color: colors.text.primary,
  },
  status: {
    ...textStyles.subheadline,
    color: colors.text.secondary,
  },
  error: {
    ...textStyles.subheadline,
    color: colors.status.danger,
  },
  assistant: {
    ...textStyles.footnoteBold,
    color: colors.accent.base,
  },
});

// `size="small"`: the smaller size of a role that has one.
const smallStyles: Partial<Record<TextVariant, TextStyle>> = StyleSheet.create({
  reading: textStyles.subheadline,
  label: textStyles.caption2Bold,
  title: textStyles.subheadlineBold,
  error: textStyles.footnote,
});

const toneStyles = StyleSheet.create({
  primary: { color: colors.text.primary },
  secondary: { color: colors.text.secondary },
  inverse: { color: colors.text.inverse },
  accent: { color: colors.accent.base },
  // The assistant's quieter violet, for its lines in the tray (SeesLine).
  accentSoft: { color: colors.accent.soft },
  danger: { color: colors.status.danger },
  // The light band sweeping across the assistant's title at work (AssistantTray).
  shine: { color: colors.accent.shine },
});
