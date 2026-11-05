import type { ReactNode } from 'react';
import {
  Text as RNText,
  StyleSheet,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { colors, lineHeights, typography } from '@/styles/designTokens';

export type TextVariant = 'reading' | 'hint' | 'label' | 'error' | 'assistant';

export type TextProps = Pick<RNTextProps, 'selectable' | 'numberOfLines' | 'accessibilityLabel'> & {
  variant?: TextVariant;
  size?: 'regular' | 'small';
  children?: ReactNode;
  style?: StyleProp<TextStyle>;
};

/**
 * Text in one of the app's roles. `variant` is what the text is:
 *   reading   — long text someone reads: a post, a model's answer (the default)
 *   hint      — small grey text that explains: a screen's intro, a field's description, a
 *               section's footer
 *   label     — the small bold grey name over a field or a group
 *   error     — what went wrong, in red. `size="small"` for a line under another
 *   assistant — the assistant's violet semibold line, footnote size: an AssistantTray's title
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
}: TextProps) {
  return (
    <RNText
      style={[styles[variant], size === 'small' && SMALL_STYLES[variant], style]}
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
  assistant: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
    fontWeight: '600',
    color: colors.accent.base,
  },
  errorSmall: {
    fontSize: typography.footnote,
    lineHeight: lineHeights.footnote,
  },
});

// `size="small"` of each variant that has one.
const SMALL_STYLES: Partial<Record<TextVariant, TextStyle>> = { error: styles.errorSmall };
