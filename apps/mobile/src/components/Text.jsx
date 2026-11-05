import { Text as RNText, StyleSheet } from 'react-native';

import { colors, textStyles } from '@/styles/designTokens';

/**
 * Text in one of the app's roles. `variant` is what the text is:
 *   reading — long text someone reads: a post, a model's answer (the default). `size="small"` for a
 *             card's line (a summary, what a chat is about)
 *   hint    — small grey text that explains: a screen's intro, a field's description, a section's
 *             footer
 *   label   — the small bold grey name over a field or a group. `size="small"` for a smaller one (a
 *             video's length on a grid cell)
 *   title   — a card's or a row's bold title. `size="small"` for a smaller one (a pick row's count)
 *   status  — a grey line about what's going on: the assistant thinking, a screen's subtitle
 *   error   — what went wrong, in red. `size="small"` for a line under another
 * `tone` gives the role another of the text colors: primary (a hint or label in the text's color),
 * secondary, inverse (on the accent, danger or a picture), accent, danger.
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
}) {
  return (
    <RNText
      style={[styles[variant], size === 'small' && styles[`${variant}Small`], tone && toneStyles[tone], style]}
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
  readingSmall: textStyles.subheadline,
  hint: {
    ...textStyles.footnote,
    color: colors.text.secondary,
  },
  label: {
    ...textStyles.footnoteBold,
    color: colors.text.secondary,
  },
  labelSmall: textStyles.caption2Bold,
  title: {
    ...textStyles.bodyBold,
    color: colors.text.primary,
  },
  titleSmall: textStyles.subheadlineBold,
  status: {
    ...textStyles.subheadline,
    color: colors.text.secondary,
  },
  error: {
    ...textStyles.subheadline,
    color: colors.status.danger,
  },
  errorSmall: textStyles.footnote,
});

const toneStyles = StyleSheet.create({
  primary: { color: colors.text.primary },
  secondary: { color: colors.text.secondary },
  inverse: { color: colors.text.inverse },
  accent: { color: colors.accent.base },
  danger: { color: colors.status.danger },
});
