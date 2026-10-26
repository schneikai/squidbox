import { Pressable, StyleSheet, Text } from 'react-native';

import Icon from '@/components/Icon';
import chipFrame from '@/styles/chipFrame';
import { colors, sizes, typography } from '@/styles/designTokens';

/**
 * A pill with a short label: a tag, a prompt button, or the dashed Add at the end of a row of them.
 * Every variant has the same frame, so a change of variant (a tag tapped on) never changes its width
 * and moves the chips after it.
 *
 * variant — `muted` (grey, a tag not chosen), `accent` (violet tint, a chosen or added tag),
 *           `outlined` (white with a violet frame, a prompt button), `add` (dashed, violet "+ label").
 * icon    — leads the label (Icon name), in the accent color; `add` always has the plus.
 */
export default function Chip({
  label,
  variant = 'muted',
  icon,
  onPress,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityLabel,
  accessibilityHint,
}) {
  const leadingIcon = variant === 'add' ? 'add' : icon;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [chipFrame, styles.chip, styles[variant], pressed && styles.pressed]}
    >
      {leadingIcon && <Icon name={leadingIcon} size={sizes.menuIcon} color={colors.accent.base} />}
      <Text style={[styles.label, (variant === 'accent' || variant === 'add') && styles.accentLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  muted: {
    backgroundColor: colors.background.muted,
  },
  accent: {
    backgroundColor: colors.accent.light,
  },
  outlined: {
    backgroundColor: colors.background.surface,
    borderColor: colors.accent.border,
  },
  add: {
    borderColor: colors.accent.border,
    borderStyle: 'dashed',
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: typography.subheadline,
    color: colors.text.primary,
  },
  accentLabel: {
    color: colors.accent.base,
  },
});
