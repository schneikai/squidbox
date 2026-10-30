import { Text as RNText, StyleSheet } from 'react-native';

import { colors, lineHeights, typography } from '@/styles/designTokens';

/**
 * Text in one of the app's roles. `variant` is what the text is:
 *   reading — long text someone reads: a post, a model's answer (the default)
 *   hint    — small grey text that explains: a screen's intro, a field's description, a section's
 *             footer
 *   label   — the small bold grey name over a field or a group
 *   error   — what went wrong, in red. `size="small"` for a line under another
 * `selectable` lets it be copied, `numberOfLines` cuts a long one short. style is for layout only.
 * Nested Texts (a bold lead-in) inherit the role.
 */
export default function Text({
  variant = 'reading',
  size = 'regular',
  children,
  selectable,
  numberOfLines,
  accessibilityLabel,
  style,
}) {
  return (
    <RNText
      style={[styles[variant], size === 'small' && styles[`${variant}Small`], style]}
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
    fontSize: typography.body,
    lineHeight: lineHeights.reading,
    color: colors.text.primary,
  },
  hint: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
    color: colors.text.secondary,
  },
  label: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  error: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.status.danger,
  },
  errorSmall: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
  },
});
